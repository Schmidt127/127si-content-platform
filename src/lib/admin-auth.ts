/** Resolves a Supabase access token to a user ID, or null when the token is not valid. */
export type TokenVerifier = (token: string) => Promise<string | null>;

export type AdminAuthorization =
  | { ok: true; userId: string }
  | { ok: false; status: 401 | 503; error: string };

/**
 * Admin routes accept any valid Supabase user token; there is no separate
 * admin role yet. Callers must check this before any privileged operation.
 */
export async function authorizeAdmin(token: string | null, verify: TokenVerifier | null): Promise<AdminAuthorization> {
  if (!token) return { ok: false, status: 401, error: "Authentication required" };
  if (!verify) return { ok: false, status: 503, error: "Admin service is not configured" };
  try {
    const userId = await verify(token);
    return userId ? { ok: true, userId } : { ok: false, status: 401, error: "Invalid authentication" };
  } catch {
    return { ok: false, status: 401, error: "Invalid authentication" };
  }
}
