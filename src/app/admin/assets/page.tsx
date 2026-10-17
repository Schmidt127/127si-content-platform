"use client";
import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { getBrowserSession } from "@/lib/supabase-browser";
type Asset = { id: string; filename: string; display_name?: string; description?: string | null; asset_kind: string; mime_type?: string | null; file_size?: number | null; tags?: string[]; created_at: string; content_media?: { content_items?: { title: string } | null }[] };
type RecordItem = { id: string; title: string; status: string; content_type: string };
const input = { display: "block", width: "100%", padding: 10, marginTop: 5 } as const;
export default function AssetsPage() {
  const [assets, setAssets] = useState<Asset[]>([]); const [records, setRecords] = useState<RecordItem[]>([]); const [search, setSearch] = useState(""); const [kind, setKind] = useState(""); const [message, setMessage] = useState(""); const [loading, setLoading] = useState(true);
  async function session() { const current = await getBrowserSession(); if (!current) { window.location.href = "/admin/login"; return null; } return current; }
  const load = useCallback(async () => { const current = await session(); if (!current) return; setLoading(true); const params = new URLSearchParams(); if (search) params.set("search", search); if (kind) params.set("kind", kind); const headers = { Authorization: `Bearer ${current.access_token}` }; const [assetResponse, recordResponse] = await Promise.all([fetch(`/api/admin/assets?${params}`, { headers }), fetch("/api/admin/content", { headers })]); const assetResult = await assetResponse.json(); const recordResult = await recordResponse.json(); setAssets(assetResult.data ?? []); setRecords(recordResult.data ?? []); setLoading(false); if (!assetResponse.ok) setMessage(assetResult.error ?? "Could not load assets."); }, [search, kind]);
  useEffect(() => { void load(); }, [load]);
  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    try {
      const current = await session();
      if (!current) return;
      const file = form.get("file");
      if (!(file instanceof File) || !file.size) {
        setMessage("Choose a file first.");
        return;
      }
      setMessage("Uploading...");
      const response = await fetch("/api/admin/assets", { method: "POST", headers: { Authorization: `Bearer ${current.access_token}` }, body: form });
      const result = await response.json();
      if (!response.ok) {
        setMessage(result.error ?? "Upload failed.");
        return;
      }
      setMessage("Asset uploaded. Attach it to a content record below.");
      formEl.reset();
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Upload failed.");
    }
  }
  async function attach(assetId: string, event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formEl = event.currentTarget;
    const contentItemId = new FormData(formEl).get("content_item_id");
    try {
      const current = await session();
      if (!current) return;
      const response = await fetch("/api/admin/assets", { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${current.access_token}` }, body: JSON.stringify({ asset_id: assetId, content_item_id: contentItemId }) });
      const result = await response.json().catch(() => ({}));
      setMessage(response.ok ? "Asset attached to content." : ((result as { error?: string }).error ?? "Could not attach asset."));
      if (response.ok) formEl.reset();
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not attach asset.");
    }
  }
  function size(bytes?: number | null) { if (!bytes) return "—"; return `${(bytes / 1024 / 1024).toFixed(1)} MB`; }
  return <main className="shell"><nav className="nav"><div className="brand">127SI ADMIN</div><div className="navlinks"><Link href="/admin">Content</Link><Link href="/admin/new">New content</Link><Link href="/">View site</Link></div></nav><section className="hero"><div className="eyebrow">Asset library</div><h1>All your files in one place.</h1><p className="muted">Upload reusable images, videos, PDFs, and documents, then attach them to published content.</p><form onSubmit={upload} className="card" style={{ display: "grid", gap: 12, maxWidth: 720, marginTop: 24 }}><h2>Upload an asset</h2><label>File<input required name="file" type="file" accept="image/*,video/*,.pdf,.doc,.docx,.txt,.csv,.xlsx" style={input} /></label><label>Display name<input name="display_name" placeholder="Friendly name" style={input} /></label><label>Description<textarea name="description" rows={2} placeholder="What is this file for?" style={input} /></label><label>Tags<input name="tags" placeholder="shooting, footwork, summer" style={input} /></label><label>Alt text<input name="alt_text" placeholder="Describe the image for accessibility" style={input} /></label><label>Caption<input name="caption" placeholder="Optional caption" style={input} /></label><button className="button" type="submit" style={{ border: 0, cursor: "pointer", width: "fit-content" }}>Upload file</button></form>{message && <p className="muted">{message}</p>}<div style={{ display: "flex", gap: 10, marginTop: 28, flexWrap: "wrap" }}><input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => { if (e.key === "Enter") void load(); }} placeholder="Search files" style={{ ...input, maxWidth: 320, marginTop: 0 }} /><select value={kind} onChange={e => setKind(e.target.value)} style={{ ...input, maxWidth: 180, marginTop: 0 }}><option value="">All file types</option><option value="image">Images</option><option value="video">Videos</option><option value="document">Documents</option><option value="file">Other files</option></select><button className="button" onClick={() => void load()} style={{ border: 0, cursor: "pointer", marginTop: 0 }}>Search</button></div><p className="muted">{loading ? "Loading assets..." : `${assets.length} asset${assets.length === 1 ? "" : "s"}`}</p><div style={{ display: "grid", gap: 12 }}>{assets.map(asset => <article className="card" key={asset.id}><h2>{asset.display_name || asset.filename}</h2><p className="muted">{asset.asset_kind} · {asset.mime_type || "unknown type"} · {size(asset.file_size)}</p>{asset.description && <p>{asset.description}</p>}<p className="muted">Used by: {asset.content_media?.length ? asset.content_media.map(link => link.content_items?.title).filter(Boolean).join(", ") : "Not linked to content yet"}</p><form onSubmit={event => void attach(asset.id, event)} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "end" }}><label style={{ flex: 1, minWidth: 240 }}>Attach to record<select required name="content_item_id" style={input}><option value="">Choose a content record</option>{records.map(record => <option key={record.id} value={record.id}>{record.title} ({record.status})</option>)}</select></label><button className="button" type="submit" style={{ border: 0, cursor: "pointer" }}>Attach</button></form></article>)}</div></section></main>;
}
