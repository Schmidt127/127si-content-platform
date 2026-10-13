export const REQUIRED_RUNTIME_ENV = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

export type RuntimeConfigReport = {
  ready: boolean;
  missing: string[];
  invalid: string[];
};

export function inspectRuntimeConfig(env: Record<string, string | undefined> = process.env): RuntimeConfigReport {
  const missing = REQUIRED_RUNTIME_ENV.filter((name) => !env[name]?.trim());
  const invalid: string[] = [];
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL?.trim();

  if (supabaseUrl) {
    try {
      const parsed = new URL(supabaseUrl);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") invalid.push("NEXT_PUBLIC_SUPABASE_URL");
    } catch {
      invalid.push("NEXT_PUBLIC_SUPABASE_URL");
    }
  }

  return { ready: missing.length === 0 && invalid.length === 0, missing, invalid };
}
