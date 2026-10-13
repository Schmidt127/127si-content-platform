import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";

// Exercise real route handlers and authorization, with only Auth/database and
// NextResponse adapters replaced. A forbidden request cannot touch service_role.
const root = new URL("../", import.meta.url);
process.env.CONTENT_SECURE_PUBLISHING = "true";
const state = { user: null as Record<string, unknown> | null, privilegedCalls: 0, rpcCalls: [] as unknown[], rpcError: null as unknown };
Object.assign(globalThis, { contentRouteTest: state });
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "next/server") return { url: "data:text/javascript,export const NextResponse = {json:(body, options)=>Response.json(body, options)}", shortCircuit: true };
    if (specifier.endsWith("/supabase") || specifier === "./supabase") return { url: "data:text/javascript," + encodeURIComponent(`
      export const getSupabasePublic = () => ({auth:{getUser:async()=>({data:{user:globalThis.contentRouteTest.user},error:null})}});
      export const getSupabaseAdmin = () => { const s=globalThis.contentRouteTest;s.privilegedCalls++;return {
        rpc:async(name,args)=>{s.rpcCalls.push({name,args});return {error:s.rpcError};},
        from:()=>({select:()=>({order:async()=>({data:[],error:null}),eq:()=>({single:async()=>({data:{id:'item'},error:null})})})})
      };};`), shortCircuit: true };
    if (specifier.startsWith("@/")) return { url: new URL("src/" + specifier.slice(2) + ".ts", root).href, shortCircuit: true };
    if (specifier === "./admin-authorization") return { url: new URL("src/lib/admin-authorization.ts", root).href, shortCircuit: true };
    return next(specifier, context);
  },
});

const cases = [
  ["content/route.ts", ["GET", "POST"]],
  ["content/[id]/route.ts", ["GET", "PATCH"]],
  ["assets/route.ts", ["GET", "POST", "PUT"]],
  ["content/[id]/media/route.ts", ["POST"]],
  ["content/[id]/media/sign/route.ts", ["POST"]],
  ["content/[id]/media/complete/route.ts", ["POST"]],
  ["content/[id]/releases/route.ts", ["GET", "POST"]],
  ["content/[id]/releases/[releaseId]/route.ts", ["PATCH"]],
] as const;

test("every privileged route rejects unauthenticated/non-admin callers before database or body access", async () => {
  for (const [path, methods] of cases) {
    const route = await import(pathToFileURL(fileURLToPath(new URL("src/app/api/admin/" + path, root))).href);
    for (const method of methods) for (const [user, expected] of [[null, 401], [{ id: "ordinary", user_metadata: { content_admin: true } }, 403]] as const) {
      state.user = user; state.privilegedCalls = 0;
      const response = await route[method](new Request("https://content.test", { method, headers: { authorization: "Bearer token" } }), { params: Promise.resolve({ id: "item" }) });
      assert.equal(response.status, expected, `${method} ${path}`);
      assert.equal(state.privilegedCalls, 0, `${method} ${path} instantiated privileged client`);
    }
  }
});

test("approved admin can read drafts and publication uses one atomic RPC with explicit errors", async () => {
  state.user = { id: "admin", app_metadata: { content_admin: true } };
  const route = await import(new URL("src/app/api/admin/content/[id]/route.ts", root).href);
  assert.equal((await route.GET(new Request("https://content.test", { headers: { authorization: "Bearer token" } }), { params: Promise.resolve({ id: "item" }) })).status, 200);
  const patch = (status: string) => route.PATCH(new Request("https://content.test", { method: "PATCH", headers: { authorization: "Bearer token", "content-type": "application/json" }, body: JSON.stringify({ status }) }), { params: Promise.resolve({ id: "item" }) });
  state.rpcCalls = [];
  assert.equal((await patch("published")).status, 200);
  assert.deepEqual(state.rpcCalls, [{ name: "set_content_status", args: { p_content_id: "item", p_status: "published" } }]);
  assert.equal((await patch("removed")).status, 400);
  state.rpcError = { code: "P0002", message: "Content not found" };
  assert.equal((await patch("published")).status, 404);
});
