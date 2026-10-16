import { NextResponse } from "next/server";
import { getSupabasePublic } from "@/lib/supabase";
import { mapPublicMediaUrls, PUBLIC_CACHE_HEADERS } from "@/lib/api-contract";
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, paginationMeta, parseContentType, parsePositiveInt, publicContentResponse } from "@/lib/content-api";
import { parsePublicDestination, toPublicDestinationItem, type DestinationContentRow } from "@/lib/content-releases";

function withMediaUrls(items: ReturnType<typeof toPublicDestinationItem>[]) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return items.map((item) => ({ ...item, media: mapPublicMediaUrls(item.media, base) }));
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const destination = parsePublicDestination(url.searchParams.get("destination"));
  if (!destination.ok) return NextResponse.json({ error: destination.error }, { status: 400 });
  const rawType = url.searchParams.get("type");
  const type = parseContentType(rawType);
  if (rawType && !type) return NextResponse.json({ error: "Invalid type. Use tutorial, fbc_book, or shout_out." }, { status: 400 });
  const challengeId = url.searchParams.get("challenge_id")?.trim() || null;
  const page = parsePositiveInt(url.searchParams.get("page"), 1);
  const pageSize = parsePositiveInt(url.searchParams.get("page_size"), DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const supabase = getSupabasePublic();
  if (!supabase) return NextResponse.json({ error: "Content service is not configured" }, { status: 503, headers: PUBLIC_CACHE_HEADERS });
  let query = supabase.from("published_destination_content").select("*", { count: "exact" })
    .eq("destination_key", destination.destination)
    .order("release_featured", { ascending: false })
    .order("release_display_order", { ascending: true })
    .order("published_at", { ascending: false })
    .order("id", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);
  if (type) query = query.eq("content_type", type);
  if (challengeId) query = query.contains("challenge_ids", [challengeId]);
  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: "Unable to load published content" }, { status: 500 });
  const items = ((data ?? []) as DestinationContentRow[]).map(toPublicDestinationItem);
  return NextResponse.json(publicContentResponse(withMediaUrls(items), paginationMeta(page, pageSize, count ?? 0)), { headers: PUBLIC_CACHE_HEADERS });
}
