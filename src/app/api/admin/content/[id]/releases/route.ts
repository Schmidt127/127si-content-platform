import { NextResponse } from "next/server";
import { authenticateContentAdmin } from "@/lib/admin-auth";
import { readJsonRecord } from "@/lib/api-contract";
import { createRelease, listReleaseOverview } from "@/lib/release-service";
import { supabaseReleaseStore } from "@/lib/supabase-release-store";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateContentAdmin(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await params;
  try {
    const result = await listReleaseOverview(supabaseReleaseStore(auth.adminClient), id, new Date());
    return NextResponse.json(result.body, { status: result.status });
  } catch {
    return NextResponse.json({ error: "Unable to load releases" }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateContentAdmin(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await params;
  const body = await readJsonRecord(request);
  if (!body.ok) return NextResponse.json({ error: body.error }, { status: 400 });
  try {
    const result = await createRelease(supabaseReleaseStore(auth.adminClient), id, body.value, auth.userId, new Date());
    return NextResponse.json(result.body, { status: result.status });
  } catch {
    return NextResponse.json({ error: "Unable to save release" }, { status: 500 });
  }
}
