import { NextResponse } from "next/server";
import { authenticateContentAdmin } from "@/lib/admin-auth";
import { parseSignedUploadInput } from "@/lib/media-upload";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateContentAdmin(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const client = auth.adminClient;

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
  if (error) return NextResponse.json({ error: "Unable to prepare the upload" }, { status: 500 });
  return NextResponse.json({ path, token: data.token });
}
