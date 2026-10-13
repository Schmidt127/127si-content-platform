import { NextResponse } from "next/server";
import { getAdminTokenVerifier, getSupabaseAdmin } from "@/lib/supabase";
import { getBearerToken, readJsonRecord } from "@/lib/api-contract";
import { authorizeAdmin } from "@/lib/admin-auth";
import { createRelease, listReleaseOverview } from "@/lib/release-service";
import { supabaseReleaseStore } from "@/lib/supabase-release-store";

async function adminContext(request: Request) {
  const auth = await authorizeAdmin(getBearerToken(request), getAdminTokenVerifier());
  if (!auth.ok) return { response: NextResponse.json({ error: auth.error }, { status: auth.status }) };
  const client = getSupabaseAdmin();
  if (!client) return { response: NextResponse.json({ error: "Admin service is not configured" }, { status: 503 }) };
  return { userId: auth.userId, store: supabaseReleaseStore(client) };
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await adminContext(request);
  if ("response" in context) return context.response;
  const { id } = await params;
  try {
    const result = await listReleaseOverview(context.store, id, new Date());
    return NextResponse.json(result.body, { status: result.status });
  } catch {
    return NextResponse.json({ error: "Unable to load releases" }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await adminContext(request);
  if ("response" in context) return context.response;
  const { id } = await params;
  const body = await readJsonRecord(request);
  if (!body.ok) return NextResponse.json({ error: body.error }, { status: 400 });
  try {
    const result = await createRelease(context.store, id, body.value, context.userId, new Date());
    return NextResponse.json(result.body, { status: result.status });
  } catch {
    return NextResponse.json({ error: "Unable to save release" }, { status: 500 });
  }
}
