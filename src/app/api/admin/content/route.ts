import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin, getSupabasePublic } from "@/lib/supabase";
import { databaseFailure, getBearerToken, readJsonRecord } from "@/lib/api-contract";
import { isOpenRelease, releaseState, visibleDestinations, type Destination, type ReleaseWindow } from "@/lib/content-releases";

const contentSchema = z.object({
  content_type: z.enum(["tutorial", "fbc_book", "shout_out"]),
  title: z.string().trim().min(1),
  slug: z.string().trim().min(1),
  short_description: z.string().optional(),
  type_data: z.record(z.string(), z.unknown()).default({}),
  visibility: z.enum(["public", "link_only"]).default("public"),
});

export async function POST(request: Request) {
  const token = getBearerToken(request);
  if (!token) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const publicClient = getSupabasePublic();
  const adminClient = getSupabaseAdmin();
  if (!publicClient || !adminClient) return NextResponse.json({ error: "Admin service is not configured" }, { status: 503 });
  const authClient = publicClient.auth as unknown as { getUser: (jwt: string) => Promise<{ data: { user: { id: string } | null }; error: Error | null }> };
  const { data: auth, error: authError } = await authClient.getUser(token);
  if (authError || !auth.user) return NextResponse.json({ error: "Invalid authentication" }, { status: 401 });
  const body = await readJsonRecord(request);
  if (!body.ok) return NextResponse.json({ error: body.error }, { status: 400 });
  const parsed = contentSchema.safeParse(body.value);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const input = parsed.data;
  if (input.content_type === "shout_out" && input.type_data.permission_confirmed !== true) return NextResponse.json({ error: "Shout Outs require permission confirmation" }, { status: 400 });
  const { data, error } = await adminClient.from("content_items").insert({ ...input, created_by: auth.user.id }).select("id").single();
  if (error) {
    const failure = databaseFailure(error, "Unable to create content");
    return NextResponse.json({ error: failure.error }, { status: failure.status });
  }
  return NextResponse.json({ data }, { status: 201 });
}

export async function GET(request: Request) {
  const token = getBearerToken(request);
  const publicClient = getSupabasePublic(); const adminClient = getSupabaseAdmin();
  if (!token || !publicClient || !adminClient) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const authClient = publicClient.auth as unknown as { getUser: (jwt: string) => Promise<{ data: { user: { id: string } | null }; error: Error | null }> };
  const { data: auth, error: authError } = await authClient.getUser(token);
  if (authError || !auth.user) return NextResponse.json({ error: "Invalid authentication" }, { status: 401 });
  const [{ data, error }, { data: published, error: publishedError }] = await Promise.all([
    adminClient.from("content_items").select("id, content_type, title, status, visibility, created_at, published_at, content_releases(destination_key, status, starts_at, ends_at)").order("created_at", { ascending: false }),
    adminClient.from("published_content").select("id"),
  ]);
  if (error || publishedError) {
    const failure = databaseFailure(error ?? publishedError, "Unable to load content records");
    return NextResponse.json({ error: failure.error }, { status: failure.status });
  }
  const now = new Date();
  const libraryPublished = new Set((published ?? []).map((row) => row.id as string));
  const records = (data ?? []).map(({ content_releases, ...item }) => {
    const releases = (content_releases ?? []) as Array<ReleaseWindow & { destination_key: Destination }>;
    return {
      ...item,
      library_version_published: libraryPublished.has(item.id),
      visible_on: visibleDestinations(libraryPublished.has(item.id), releases, now),
      open_releases: releases.filter(isOpenRelease).map((release) => ({ destination_key: release.destination_key, state: releaseState(release, now) })),
    };
  });
  return NextResponse.json({ data: records });
}
