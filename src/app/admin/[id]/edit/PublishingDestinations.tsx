"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { DESTINATIONS, DESTINATION_LABELS, RELEASE_STATE_LABELS, isOpenRelease, type ContentRelease, type Destination, type ReleaseAction, type ReleaseState } from "@/lib/content-releases";

type Release = ContentRelease & { state: ReleaseState };
type Overview = { library_version_published: boolean; visible_on: Destination[]; releases: Release[] };

const input = { display: "block", width: "100%", padding: 10, marginTop: 6 } as const;

function toIso(localValue: FormDataEntryValue | null) {
  const value = String(localValue ?? "").trim();
  return value ? new Date(value).toISOString() : null;
}

function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const date = new Date(iso);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function formatDate(iso: string | null) {
  return iso ? new Date(iso).toLocaleString() : "—";
}

function windowSummary(release: Release) {
  const start = release.starts_at ? `from ${formatDate(release.starts_at)}` : "start not set";
  return `${start} · ${release.ends_at ? `until ${formatDate(release.ends_at)}` : "permanent"}`;
}

export function PublishingDestinations({ contentId, getToken, refreshKey }: { contentId: string; getToken: () => Promise<string | null>; refreshKey: number }) {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [adding, setAdding] = useState<Record<Destination, boolean>>({ challenge: false, referee: false });
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const request = useCallback(async (path: string, init?: RequestInit) => {
    const token = await getToken();
    if (!token) { window.location.href = "/admin/login"; return null; }
    const response = await fetch(`/api/admin/content/${contentId}/releases${path}`, { ...init, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` } });
    const result = await response.json().catch(() => ({}));
    return { ok: response.ok, result };
  }, [contentId, getToken]);

  const load = useCallback(async () => {
    const response = await request("");
    if (!response) return;
    if (!response.ok) { setMessage(response.result.error ?? "Could not load publishing destinations."); return; }
    setOverview(response.result.data);
  }, [request]);

  useEffect(() => { void load(); }, [load, refreshKey]);

  async function addRelease(destination: Destination, event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const mode = String(values.get("publish") ?? "now");
    const permanent = values.get("permanent") === "on";
    const body = {
      destination_key: destination,
      publish: mode,
      starts_at: mode === "now" ? null : toIso(values.get("starts_at")),
      ends_at: permanent ? null : toIso(values.get("ends_at")),
      featured: values.get("featured") === "on",
      display_order: Number(values.get("display_order") ?? 0),
    };
    if (!permanent && !body.ends_at) { setMessage("Choose an end date or mark the release as permanent."); return; }
    setBusy(true); setMessage(`Saving ${DESTINATION_LABELS[destination]} release...`);
    const response = await request("", { method: "POST", body: JSON.stringify(body) });
    setBusy(false);
    if (!response) return;
    setMessage(response.ok ? `${DESTINATION_LABELS[destination]} release saved.` : response.result.error ?? "Could not save this release.");
    if (response.ok) { setAdding((current) => ({ ...current, [destination]: false })); await load(); }
  }

  async function changeRelease(release: Release, body: { action?: ReleaseAction; starts_at?: string | null; ends_at?: string | null; featured?: boolean; display_order?: number }, success: string) {
    setBusy(true); setMessage("Updating release...");
    const response = await request(`/${release.id}`, { method: "PATCH", body: JSON.stringify(body) });
    setBusy(false);
    if (!response) return;
    setMessage(response.ok ? success : response.result.error ?? "Could not update this release.");
    if (response.ok) await load();
  }

  async function saveReleaseSettings(release: Release, event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const permanent = values.get("permanent") === "on";
    const endsAt = permanent ? null : toIso(values.get("ends_at"));
    if (!permanent && !endsAt) { setMessage("Choose an end date or mark the release as permanent."); return; }
    await changeRelease(release, { starts_at: toIso(values.get("starts_at")), ends_at: endsAt, featured: values.get("featured") === "on", display_order: Number(values.get("display_order") ?? 0) }, "Release settings saved.");
  }

  if (!overview) return <section className="card" style={{ marginTop: 32 }}><h2>Publishing destinations</h2><p className="muted">{message || "Loading publishing destinations..."}</p></section>;

  return <section className="card" style={{ marginTop: 32, display: "grid", gap: 16, maxWidth: 820 }}>
    <div>
      <div className="eyebrow">Where and when this record appears</div>
      <h2>Publishing destinations</h2>
      <p className="muted">This content record is the reusable library item. A destination release controls where it appears. Publishing to one destination does not publish it everywhere, and a record with no active release is not visible on either public destination.</p>
    </div>
    <div className="notice compact-notice">
      <strong>Currently visible on: </strong>{overview.visible_on.length ? overview.visible_on.map((key) => DESTINATION_LABELS[key]).join(" and ") : "No destination"}
      {!overview.library_version_published && <p className="muted">The library version is not published, so no destination shows this record yet. Publish the library version above; destination releases take effect once it is published.</p>}
    </div>

    {DESTINATIONS.map((destination) => {
      const open = overview.releases.find((release) => release.destination_key === destination && isOpenRelease(release));
      return <fieldset key={destination} style={{ border: "1px solid #d9e2ec", borderRadius: 12, padding: 16 }}>
        <legend style={{ padding: "0 6px" }}>
          <label style={{ fontWeight: 700 }}>
            <input type="checkbox" checked={Boolean(open) || adding[destination]} disabled={Boolean(open) || busy} onChange={(event) => setAdding((current) => ({ ...current, [destination]: event.target.checked }))} /> {DESTINATION_LABELS[destination]}
          </label>{" "}
          {open && <span className={`status status-${open.state}`}>{RELEASE_STATE_LABELS[open.state]}</span>}
        </legend>

        {open ? <div style={{ display: "grid", gap: 12 }}>
          <p className="muted compact">{windowSummary(open)}{open.featured ? " · featured" : ""} · display order {open.display_order}</p>
          <form onSubmit={(event) => void saveReleaseSettings(open, event)} style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
            <label>Starts<input name="starts_at" type="datetime-local" defaultValue={toLocalInput(open.starts_at)} style={input} /></label>
            <label>Ends<input name="ends_at" type="datetime-local" defaultValue={toLocalInput(open.ends_at)} style={input} /></label>
            <label><input name="permanent" type="checkbox" defaultChecked={!open.ends_at} /> Permanent (no end date)</label>
            <label><input name="featured" type="checkbox" defaultChecked={open.featured} /> Featured</label>
            <label>Display order<input name="display_order" type="number" min={0} defaultValue={open.display_order} style={input} /></label>
            <div style={{ alignSelf: "end" }}><button className="button" type="submit" disabled={busy} style={{ border: 0, cursor: "pointer" }}>Save release settings</button></div>
          </form>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {open.status === "draft" && <button className="button" disabled={busy} style={{ border: 0, cursor: "pointer" }} onClick={() => void changeRelease(open, { action: "publish" }, `${DESTINATION_LABELS[destination]} release published.`)}>Publish to {DESTINATION_LABELS[destination]}</button>}
            {open.status === "published" && <button className="button" disabled={busy} style={{ border: 0, cursor: "pointer" }} onClick={() => void changeRelease(open, { action: "unpublish" }, `Removed from ${DESTINATION_LABELS[destination]}.`)}>Unpublish from {DESTINATION_LABELS[destination]}</button>}
            <button className="button" disabled={busy} style={{ border: 0, cursor: "pointer" }} onClick={() => void changeRelease(open, { action: "archive" }, `${DESTINATION_LABELS[destination]} release archived.`)}>Archive release</button>
          </div>
          <p className="muted compact">Unpublishing or archiving removes this record from {DESTINATION_LABELS[destination]} only. The library record and other destinations are unchanged.</p>
        </div> : adding[destination] ? <form onSubmit={(event) => void addRelease(destination, event)} style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
          <label>When<select name="publish" defaultValue="now" style={input}><option value="now">Publish immediately</option><option value="schedule">Schedule publication</option><option value="draft">Save as draft release</option></select></label>
          <label>Starts (for scheduled or draft releases)<input name="starts_at" type="datetime-local" style={input} /></label>
          <label><input name="permanent" type="checkbox" defaultChecked /> Permanent (no end date)</label>
          <label>Ends (when not permanent)<input name="ends_at" type="datetime-local" style={input} /></label>
          <label><input name="featured" type="checkbox" /> Featured</label>
          <label>Display order<input name="display_order" type="number" min={0} defaultValue={0} style={input} /></label>
          <div><button className="button" type="submit" disabled={busy} style={{ border: 0, cursor: "pointer" }}>Add {DESTINATION_LABELS[destination]} release</button></div>
        </form> : <p className="muted compact">Not released to {DESTINATION_LABELS[destination]}. Check the box to add a release.</p>}
      </fieldset>;
    })}

    {message && <p className="muted">{message}</p>}

    <div>
      <h3>Release history</h3>
      {overview.releases.length === 0 ? <p className="muted">No releases yet. This record is not visible on any destination.</p> : <div className="record-table">
        {overview.releases.map((release) => <div className="record-row" key={release.id}>
          <div><strong>{DESTINATION_LABELS[release.destination_key]}</strong><p className="muted compact">{windowSummary(release)}{release.featured ? " · featured" : ""} · order {release.display_order}</p><p className="muted compact">Created {formatDate(release.created_at)} · published {formatDate(release.published_at)} · unpublished {formatDate(release.unpublished_at)} · archived {formatDate(release.archived_at)}</p></div>
          <span className={`status status-${release.state}`}>{RELEASE_STATE_LABELS[release.state]}</span>
          <span />
        </div>)}
      </div>}
    </div>
  </section>;
}
