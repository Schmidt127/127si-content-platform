import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin, getSupabasePublic } from "@/lib/supabase";
import { databaseFailure, getBearerToken, parseAdminStatus, readJsonRecord } from "@/lib/api-contract";

const editSchema = z.object({
  content_type: z.enum(["tutorial", "fbc_book", "shout_out"]),
  title: z.string().trim().min(1),
  slug: z.string().trim().min(1),
  short_description: z.string().optional(),
  type_data: z.record(z.string(), z.unknown()).default({}),
  visibility: z.enum(["public", "link_only"]).default("public"),
});

async function authorized(request: Request) {
  const token = getBearerToken(request);
  const publicClient = getSupabasePublic(); const adminClient = getSupabaseAdmin();
  if (!token || !publicClient || !adminClient) return null;
  const authClient = publicClient.auth as unknown as { getUser: (jwt: string) => Promise<{ data: { user: { id: string } | null }; error: Error | null }> };
  const { data, error } = await authClient.getUser(token);
  return error || !data.user ? null : adminClient;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const client = await authorized(request);
  if (!client) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
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
  if (!status) return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  if (status === "published") {
    const { data: item, error: itemError } = await client.from("content_items").select("id, content_type, title, slug, short_description, long_description, rationale, type_data, visibility").eq("id", id).single();
    if (itemError || !item) return NextResponse.json({ error: "Content not found" }, { status: 404 });
    const { data: latest } = await client.from("content_revisions").select("revision_number").eq("content_item_id", id).order("revision_number", { ascending: false }).limit(1).maybeSingle();
    const { error: revisionError } = await client.from("content_revisions").insert({ content_item_id: id, revision_number: (latest?.revision_number ?? 0) + 1, snapshot: item });
    if (revisionError) {
      const failure = databaseFailure(revisionError, "Unable to save content revision");
      return NextResponse.json({ error: failure.error }, { status: failure.status });
    }
  }
  const { error } = await client.from("content_items").update({ status, published_at: status === "published" ? new Date().toISOString() : null }).eq("id", id);
  if (error) {
    const failure = databaseFailure(error, "Unable to update content status");
    return NextResponse.json({ error: failure.error }, { status: failure.status });
  }
  return NextResponse.json({ ok: true });
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const client = await authorized(request);
  if (!client) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { id } = await params;
  const { data, error } = await client.from("content_items").select("id, content_type, title, slug, short_description, type_data, status, visibility, updated_at").eq("id", id).single();
  if (error || !data) return NextResponse.json({ error: "Content not found" }, { status: 404 });
  return NextResponse.json({ data });
}
