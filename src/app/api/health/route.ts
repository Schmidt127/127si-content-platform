import { NextResponse } from "next/server";
import { inspectRuntimeConfig } from "@/lib/runtime-config";
import { getSupabaseAdmin, getSupabasePublic } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type HealthCheck = {
  status: "ok" | "error" | "not_configured";
  message: string;
};

const NO_STORE_HEADERS = { "Cache-Control": "no-store" };

function ok(message: string): HealthCheck {
  return { status: "ok", message };
}

function error(message: string): HealthCheck {
  return { status: "error", message };
}

export async function GET() {
  const config = inspectRuntimeConfig();
  const configuration = config.ready
    ? ok("Required runtime configuration is present.")
    : error(`Missing or invalid configuration: ${[...config.missing, ...config.invalid].join(", ")}.`);
  const checks: Record<string, HealthCheck> = {
    configuration,
    database: config.ready ? error("Checking published content access.") : { status: "not_configured", message: "Skipped until runtime configuration is complete." },
    destinations: config.ready ? error("Checking destination release access.") : { status: "not_configured", message: "Skipped until runtime configuration is complete." },
    storage: config.ready ? error("Checking content-media storage.") : { status: "not_configured", message: "Skipped until runtime configuration is complete." },
  };

  if (config.ready) {
    const publicClient = getSupabasePublic();
    const adminClient = getSupabaseAdmin();
    const [databaseResult, destinationResult, storageResult] = await Promise.all([
      publicClient?.from("published_content").select("id", { head: true, count: "exact" }),
      publicClient?.from("published_destination_content").select("id", { head: true, count: "exact" }),
      adminClient?.storage.from("content-media").list("", { limit: 1 }),
    ]);

    checks.database = !databaseResult || databaseResult.error
      ? error("Published content access is unavailable.")
      : ok("Published content access is available.");
    checks.destinations = !destinationResult || destinationResult.error
      ? error("Destination release access is unavailable. Confirm migration 0006_content_releases.sql is applied.")
      : ok("Destination release access is available.");
    checks.storage = !storageResult || storageResult.error
      ? error("The content-media storage bucket is unavailable.")
      : ok("The content-media storage bucket is available.");
  }

  const healthy = Object.values(checks).every((check) => check.status === "ok");
  return NextResponse.json(
    { status: healthy ? "ok" : "degraded", checks },
    { status: healthy ? 200 : 503, headers: NO_STORE_HEADERS },
  );
}
