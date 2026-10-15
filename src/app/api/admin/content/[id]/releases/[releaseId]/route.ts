import { NextResponse } from "next/server";
import { authenticateContentAdmin } from "@/lib/admin-auth";
import { readJsonRecord } from "@/lib/api-contract";
import { updateRelease } from "@/lib/release-service";
import { supabaseReleaseStore } from "@/lib/supabase-release-store";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; releaseId: string }> }) {
  const auth = await authenticateContentAdmin(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id, releaseId } = await params;
  const body = await readJsonRecord(request);
  if (!body.ok) return NextResponse.json({ error: body.error }, { status: 400 });
  try {
    const result = await updateRelease(supabaseReleaseStore(auth.adminClient), id, releaseId, body.value, auth.userId, new Date());
    return NextResponse.json(result.body, { status: result.status });
  } catch {
    return NextResponse.json({ error: "Unable to update release" }, { status: 500 });
  }
}
