import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

// Exercise the real public route handlers with only the Supabase client and
// NextResponse replaced. These are the fields Challenge and Referee rely on.
const root = new URL("../", import.meta.url);
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.test/";
type Call = { table: string; filters: Array<[string, unknown]>; orders: Array<[string, boolean]> };
const state = { calls: [] as Call[], rows: [] as Record<string, unknown>[], count: 0 };
Object.assign(globalThis, { publicRouteTest: state });
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "next/server") return { url: "data:text/javascript,export const NextResponse = {json:(body, options)=>Response.json(body, options)}", shortCircuit: true };
    if (specifier === "@/lib/supabase") return { url: "data:text/javascript," + encodeURIComponent(`
      export const getSupabasePublic = () => ({ from(table) {
        const s = globalThis.publicRouteTest; const call = { table, filters: [], orders: [] }; s.calls.push(call);
        const q = {
          select: () => q,
          eq: (column, value) => { call.filters.push([column, value]); return q; },
          contains: (column, value) => { call.filters.push([column, value]); return q; },
          order: (column, options) => { call.orders.push([column, options.ascending]); return q; },
          range: () => q,
          maybeSingle: async () => ({ data: s.rows.find((row) => call.filters.every(([c, v]) => row[c] === v)) ?? null, error: null }),
          then: (resolve) => resolve({ data: s.rows, error: null, count: s.count }),
        };
        return q;
      } });`), shortCircuit: true };
    if (specifier.startsWith("@/")) return { url: new URL("src/" + specifier.slice(2) + ".ts", root).href, shortCircuit: true };
    return next(specifier, context);
  },
});

const row = (id: string, destination: string) => ({
  id, content_type: "tutorial", title: `Title ${id}`, slug: id, short_description: null, long_description: null, rationale: null,
  type_data: {}, visibility: "public", published_at: "2026-10-12T19:20:14Z", revision_id: `rev-${id}`, revision_number: 1, challenge_ids: [],
  media: [{ id: "m1", public_url: "/storage/v1/object/public/content-media/a.mov" }, { id: "m2", public_url: "https://cdn.test/b.png" }],
  release_id: `rel-${id}`, destination_key: destination, release_featured: true, release_display_order: 1,
  release_starts_at: "2026-10-13T20:31:00Z", release_ends_at: null, release_published_at: "2026-10-13T20:31:35Z",
});

const list = await import(new URL("src/app/api/v1/content/route.ts", root).href);
const detail = await import(new URL("src/app/api/v1/content/[id]/route.ts", root).href);
const getList = (query: string) => list.GET(new Request(`https://content.test/api/v1/content${query}`));
const getItem = (id: string, query: string) => detail.GET(new Request(`https://content.test/api/v1/content/${id}${query}`), { params: Promise.resolve({ id }) });

test("missing, blank, unknown, and differently cased destinations are rejected before any read", async () => {
  state.calls = [];
  for (const query of ["", "?destination=", "?destination=website", "?destination=Challenge"]) {
    assert.equal((await getList(query)).status, 400, query);
    assert.equal((await getItem("item-1", query)).status, 400, query);
  }
  assert.equal(state.calls.length, 0);
});

for (const destination of ["challenge", "referee"]) {
  test(`${destination} list returns release metadata for the requested destination only`, async () => {
    state.calls = []; state.rows = [row("item-1", destination)]; state.count = 1;
    const response = await getList(`?destination=${destination}&page_size=1`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get("cache-control") ?? "", /public/);
    const body = await response.json();
    assert.deepEqual(Object.keys(body.pagination).sort(), ["has_next_page", "has_previous_page", "page", "page_size", "total", "total_pages"]);
    assert.equal(body.data[0].id, "item-1");
    assert.deepEqual(body.data[0].release, { id: "rel-item-1", destination, featured: true, display_order: 1, starts_at: "2026-10-13T20:31:00Z", ends_at: null, published_at: "2026-10-13T20:31:35Z" });
    for (const key of ["release_id", "destination_key", "release_featured", "release_display_order", "release_starts_at", "release_ends_at", "release_published_at"]) assert.equal(key in body.data[0], false, key);
    assert.deepEqual(body.data[0].media.map((m: { public_url: string }) => m.public_url), ["https://project.supabase.test/storage/v1/object/public/content-media/a.mov", "https://cdn.test/b.png"]);
    assert.deepEqual(state.calls[0].table, "published_destination_content");
    assert.deepEqual(state.calls[0].filters, [["destination_key", destination]]);
    assert.deepEqual(state.calls[0].orders, [["release_featured", false], ["release_display_order", true], ["published_at", false], ["id", false]]);
  });

  test(`${destination} detail returns the item only through that destination`, async () => {
    state.calls = []; state.rows = [row("item-1", destination)];
    const found = await getItem("item-1", `?destination=${destination}`);
    assert.equal(found.status, 200);
    const body = await found.json();
    assert.equal(body.data.id, "item-1");
    assert.equal(body.data.release.destination, destination);
    const other = destination === "challenge" ? "referee" : "challenge";
    assert.equal((await getItem("item-1", `?destination=${other}`)).status, 404);
    assert.deepEqual(state.calls.map((call) => call.filters), [[["id", "item-1"], ["destination_key", destination]], [["id", "item-1"], ["destination_key", other]]]);
  });
}
