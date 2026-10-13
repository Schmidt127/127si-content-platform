import { NextResponse } from "next/server";
import { getAdminTokenVerifier, getSupabaseAdmin } from "@/lib/supabase";
import { getBearerToken, readJsonRecord } from "@/lib/api-contract";
import { authorizeAdmin } from "@/lib/admin-auth";
import { updateRelease } from "@/lib/release-service";
import { supabaseReleaseStore } from "@/lib/supabase-release-store";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; releaseId: string }> }) {
  const auth = await authorizeAdmin(getBearerToken(request), getAdminTokenVerifier());
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const client = getSupabaseAdmin();
  if (!client) return NextResponse.json({ error: "Admin service is not configured" }, { status: 503 });
  const { id, releaseId } = await params;
  const body = await readJsonRecord(request);
  if (!body.ok) return NextResponse.json({ error: body.error }, { status: 400 });
  try {
    const result = await updateRelease(supabaseReleaseStore(client), id, releaseId, body.value, auth.userId, new Date());
    return NextResponse.json(result.body, { status: result.status });
  } catch {
    return NextResponse.json({ error: "Unable to update release" }, { status: 500 });
  }
}
