import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticateContentAdmin } from "@/lib/admin-auth";
import { isSecurePublishingEnabled } from "@/lib/admin-authorization";
import { databaseFailure, parseAdminStatus, readJsonRecord } from "@/lib/api-contract";
import { applyLegacyContentStatus } from "@/lib/legacy-content-status";

const editSchema = z.object({
  content_type: z.enum(["tutorial", "fbc_book", "shout_out"]),
  title: z.string().trim().min(1),
  slug: z.string().trim().min(1),
  short_description: z.string().optional(),
  type_data: z.record(z.string(), z.unknown()).default({}),
  visibility: z.enum(["public", "link_only"]).default("public"),
});


export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateContentAdmin(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const client = auth.adminClient;
  const { id } = await params;
  const bodyResult = await readJsonRecord(request);
  if (!bodyResult.ok) return NextResponse.json({ error: bodyResult.error }, { status: 400 });
  const body = bodyResult.value;
  if (body.status === undefined) {
    const parsed = editSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    if (parsed.data.content_type === "shout_out" && parsed.data.type_data.permission_confirmed !== true) {
      return NextResponse.json({ error: "Shout Outs require permission confirmation" }, { status: 400 });
    }
    const { data, error } = await client.from("content_items").update({ ...parsed.data, status: "draft", updated_at: new Date().toISOString() }).eq("id", id).select("id, content_type, title, slug, short_description, type_data, status, visibility, updated_at").single();
    if (error) {
      const failure = databaseFailure(error, "Unable to update content");
      return NextResponse.json({ error: failure.error }, { status: failure.status });
    }
    return NextResponse.json({ data });
  }
  const status = parseAdminStatus(body.status);
  if (!status) return NextResponse.json({ error: "Invalid content status" }, { status: 400 });
  if (isSecurePublishingEnabled()) {
    const { error } = await client.rpc("set_content_status", { p_content_id: id, p_status: status });
    if (error) {
      if (error.code === "P0002") return NextResponse.json({ error: "Content not found" }, { status: 404 });
      if (error.code === "22023") return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ error: "Unable to update content status" }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }
  const legacy = await applyLegacyContentStatus(client, id, status);
  if ("error" in legacy) return NextResponse.json({ error: legacy.error }, { status: legacy.status });
  return NextResponse.json({ ok: true });
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateContentAdmin(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const client = auth.adminClient;
  const { id } = await params;
  const { data, error } = await client.from("content_items").select("id, content_type, title, slug, short_description, type_data, status, visibility, updated_at").eq("id", id).single();
  if (error || !data) return NextResponse.json({ error: "Content not found" }, { status: 404 });
  return NextResponse.json({ data });
}
