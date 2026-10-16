import { createBrowserClient } from "@supabase/ssr";
import type { Session } from "@supabase/supabase-js";

export function getSupabaseBrowser() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

export async function getBrowserSession(): Promise<Session | null> {
  const { data } = await getSupabaseBrowser().auth.getSession();
  return data.session;
}
