import { NextResponse } from "next/server";
import { getSupabasePublic } from "@/lib/supabase";
import { PUBLIC_CACHE_HEADERS, publicMediaUrl } from "@/lib/api-contract";
import { parsePublicDestination, toPublicDestinationItem, type DestinationContentRow } from "@/lib/content-releases";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const destination = parsePublicDestination(new URL(request.url).searchParams.get("destination"));
  if (!destination.ok) return NextResponse.json({ error: destination.error }, { status: 400 });
  const supabase = getSupabasePublic();
  if (!supabase) return NextResponse.json({ error: "Content service is not configured" }, { status: 503, headers: PUBLIC_CACHE_HEADERS });
  const { data, error } = await supabase.from("published_destination_content").select("*").eq("id", id).eq("destination_key", destination.destination).maybeSingle();
  if (error) return NextResponse.json({ error: "Unable to load published content" }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Content not found" }, { status: 404 });
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const item = toPublicDestinationItem(data as DestinationContentRow);
  const normalized = { ...item, media: ((item.media as any[] | undefined) ?? []).map((asset: any) => ({ ...asset, public_url: publicMediaUrl(asset.public_url, base) })) };
  return NextResponse.json({ data: normalized }, { headers: PUBLIC_CACHE_HEADERS });
}
