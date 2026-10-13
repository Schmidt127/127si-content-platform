import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticateContentAdmin } from "@/lib/admin-auth";
import { databaseFailure, readJsonRecord } from "@/lib/api-contract";

const contentSchema = z.object({
  content_type: z.enum(["tutorial", "fbc_book", "shout_out"]),
  title: z.string().trim().min(1),
  slug: z.string().trim().min(1),
  short_description: z.string().optional(),
  type_data: z.record(z.string(), z.unknown()).default({}),
  visibility: z.enum(["public", "link_only"]).default("public"),
});

export async function POST(request: Request) {
  const auth = await authenticateContentAdmin(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { adminClient, userId } = auth;
  const body = await readJsonRecord(request);
  if (!body.ok) return NextResponse.json({ error: body.error }, { status: 400 });
  const parsed = contentSchema.safeParse(body.value);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const input = parsed.data;
  if (input.content_type === "shout_out" && input.type_data.permission_confirmed !== true) return NextResponse.json({ error: "Shout Outs require permission confirmation" }, { status: 400 });
  const { data, error } = await adminClient.from("content_items").insert({ ...input, created_by: userId }).select("id").single();
  if (error) {
    const failure = databaseFailure(error, "Unable to create content");
    return NextResponse.json({ error: failure.error }, { status: failure.status });
  }
  return NextResponse.json({ data }, { status: 201 });
}

export async function GET(request: Request) {
  const auth = await authenticateContentAdmin(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { adminClient } = auth;
  const { data, error } = await adminClient.from("content_items").select("id, content_type, title, status, visibility, created_at, published_at").order("created_at", { ascending: false });
  if (error) {
    const failure = databaseFailure(error, "Unable to load content records");
    return NextResponse.json({ error: failure.error }, { status: failure.status });
  }
  return NextResponse.json({ data });
}
