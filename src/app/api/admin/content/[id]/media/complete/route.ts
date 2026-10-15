import { NextResponse } from "next/server";
import { authenticateContentAdmin } from "@/lib/admin-auth";
import { parseCompletedUploadInput, validateUploadedObjectMetadata } from "@/lib/media-upload";

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
  const input = parseCompletedUploadInput(body, id);
  if ("error" in input) return NextResponse.json({ error: input.error }, { status: 400 });

  const storage = client.storage.from("content-media");
  const objectInfo = await storage.info(input.path);
  if (objectInfo.error || !objectInfo.data || "error" in validateUploadedObjectMetadata(objectInfo.data, input)) {
    await storage.remove([input.path]);
    return NextResponse.json({ error: "The uploaded object could not be verified" }, { status: 400 });
  }

  const mimeType = input.mimeType;
  const mediaType = mimeType.startsWith("image/") ? "image" : mimeType.startsWith("video/") ? "video" : "document";
  const { data: asset, error: assetError } = await client.from("media_assets").insert({
    storage_bucket: "content-media",
    asset_kind: mediaType,
    storage_path: input.path,
    media_type: mediaType,
    mime_type: mimeType,
    filename: input.filename,
    display_name: input.filename,
    file_size: input.size,
    alt_text: input.altText,
    caption: input.caption,
    uploaded_by: auth.userId,
  }).select("id").single();
  if (assetError) {
    await storage.remove([input.path]);
    return NextResponse.json({ error: "File metadata could not be saved" }, { status: 500 });
  }

  const { error: linkError } = await client.from("content_media").insert({
    content_item_id: id,
    media_asset_id: asset.id,
    role: "primary",
    display_order: 0,
  });
  if (linkError) {
    await client.from("media_assets").delete().eq("id", asset.id);
    await storage.remove([input.path]);
    return NextResponse.json({ error: "File metadata could not be linked to the content item" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
