import { NextResponse } from "next/server";
import { destinationFilterColumn, destinationQueryError, parseDestination, publishedContentSource, stripDestinationField } from "@/lib/content-api";
import { getSupabasePublic } from "@/lib/supabase";
import { PUBLIC_CACHE_HEADERS, publicMediaUrl } from "@/lib/api-contract";
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const url = new URL(request.url);
  const rawDestination = url.searchParams.get("destination");
  const destination = parseDestination(rawDestination);
  const destinationError = destinationQueryError(rawDestination, destination);
  if (destinationError) return NextResponse.json({ error: destinationError.error }, { status: destinationError.status, headers: PUBLIC_CACHE_HEADERS });
  const supabase = getSupabasePublic();
  if (!supabase) return NextResponse.json({ error: "Content service is not configured" }, { status: 503, headers: PUBLIC_CACHE_HEADERS });
  let query = supabase.from(publishedContentSource(destination)).select("*").eq("id", id);
  if (destination) query = query.eq(destinationFilterColumn(), destination);
  const { data, error } = await query.maybeSingle();
  if (error) return NextResponse.json({ error: "Unable to load published content" }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Content not found" }, { status: 404 });
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const normalized = stripDestinationField({
    ...data,
    media: (data.media ?? []).map((asset: any) => ({
      ...asset,
      public_url: publicMediaUrl(asset.public_url, base),
    })),
  });
  return NextResponse.json({ data: normalized }, { headers: PUBLIC_CACHE_HEADERS });
}
