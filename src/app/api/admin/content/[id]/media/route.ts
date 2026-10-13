import { NextResponse } from "next/server";
import { getSupabaseAdmin, getSupabasePublic } from "@/lib/supabase";
import { parseCompletedUploadInput, parseSignedUploadInput, validateUploadedObjectMetadata } from "@/lib/media-upload";

async function authenticate(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const publicClient = getSupabasePublic();
  const adminClient = getSupabaseAdmin();
  if (!token || !publicClient || !adminClient) return { error: "Authentication required", status: 401 as const };
  const authClient = publicClient.auth as unknown as { getUser: (jwt: string) => Promise<{ data: { user: { id: string } | null }; error: Error | null }> };
  const { data, error } = await authClient.getUser(token);
  if (error || !data.user) return { error: "Invalid authentication", status: 401 as const };
  return { userId: data.user.id, adminClient };
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticate(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id: contentItemId } = await params;
  const { data: item, error: itemError } = await auth.adminClient.from("content_items").select("id").eq("id", contentItemId).maybeSingle();
  if (itemError) return NextResponse.json({ error: itemError.message }, { status: 500 });
  if (!item) return NextResponse.json({ error: "Content item not found" }, { status: 404 });
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "A media file is required" }, { status: 400 });
  const uploadInput = parseSignedUploadInput({ filename: file.name, size: file.size, mime_type: file.type });
  if ("error" in uploadInput) return NextResponse.json({ error: uploadInput.error }, { status: 400 });
  const storagePath = `${contentItemId}/${crypto.randomUUID()}.${uploadInput.extension}`;
  const upload = await auth.adminClient.storage.from("content-media").upload(storagePath, await file.arrayBuffer(), { contentType: uploadInput.mimeType, upsert: false });
  if (upload.error) return NextResponse.json({ error: upload.error.message }, { status: 500 });
  const completed = parseCompletedUploadInput({ path: storagePath, filename: uploadInput.filename, size: uploadInput.size, mime_type: uploadInput.mimeType }, contentItemId);
  const objectInfo = await auth.adminClient.storage.from("content-media").info(storagePath);
  if (objectInfo.error || !objectInfo.data || "error" in completed || "error" in validateUploadedObjectMetadata(objectInfo.data, completed)) {
    await auth.adminClient.storage.from("content-media").remove([storagePath]);
    return NextResponse.json({ error: "The uploaded object could not be verified" }, { status: 400 });
  }
  const mediaType = uploadInput.mimeType.startsWith("image/") ? "image" : uploadInput.mimeType.startsWith("video/") ? "video" : "document";
  const { data: asset, error: assetError } = await auth.adminClient.from("media_assets").insert({ storage_bucket: "content-media", asset_kind: mediaType, storage_path: storagePath, media_type: mediaType, mime_type: uploadInput.mimeType, filename: uploadInput.filename, display_name: String(form.get("display_name") ?? uploadInput.filename).trim() || uploadInput.filename, description: String(form.get("description") ?? "").trim() || null, tags: String(form.get("tags") ?? "").split(",").map(tag => tag.trim().toLowerCase()).filter(Boolean), file_size: uploadInput.size, alt_text: String(form.get("alt_text") ?? "").trim() || null, caption: String(form.get("caption") ?? "").trim() || null, uploaded_by: auth.userId }).select("id, storage_path, media_type, mime_type, filename, file_size, alt_text, caption").single();
  if (assetError) { await auth.adminClient.storage.from("content-media").remove([storagePath]); return NextResponse.json({ error: assetError.message }, { status: 500 }); }
  const { error: linkError } = await auth.adminClient.from("content_media").insert({ content_item_id: contentItemId, media_asset_id: asset.id, role: "primary", display_order: 0 });
  if (linkError) { await auth.adminClient.from("media_assets").delete().eq("id", asset.id); await auth.adminClient.storage.from("content-media").remove([storagePath]); return NextResponse.json({ error: linkError.message }, { status: 500 }); }
  return NextResponse.json({ data: asset }, { status: 201 });
}
