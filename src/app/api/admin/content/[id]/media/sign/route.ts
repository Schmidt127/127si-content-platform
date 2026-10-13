import { NextResponse } from "next/server";
import { getSupabaseAdmin, getSupabasePublic } from "@/lib/supabase";
import { parseSignedUploadInput } from "@/lib/media-upload";

async function authenticate(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const publicClient = getSupabasePublic();
  const adminClient = getSupabaseAdmin();
  if (!token || !publicClient || !adminClient) return null;
  const { data, error } = await (publicClient.auth as any).getUser(token);
  return error || !data.user ? null : adminClient;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const client = await authenticate(request);
  if (!client) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  const { id } = await params;
  const { data: item, error: itemError } = await client.from("content_items").select("id").eq("id", id).maybeSingle();
  if (itemError) return NextResponse.json({ error: "Unable to verify content item" }, { status: 500 });
  if (!item) return NextResponse.json({ error: "Content item not found" }, { status: 404 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid upload request" }, { status: 400 });
  }
  const input = parseSignedUploadInput(body);
  if ("error" in input) return NextResponse.json({ error: input.error }, { status: 400 });

  const path = `${id}/${crypto.randomUUID()}.${input.extension}`;
  const { data, error } = await client.storage.from("content-media").createSignedUploadUrl(path);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ path, token: data.token });
}
