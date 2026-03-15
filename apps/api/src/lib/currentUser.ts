import { createSupabaseAnonClient } from "@prescription-companion/supabase";

function getBearerToken(authorization?: string) {
  if (!authorization) {
    return null;
  }

  const [scheme, token] = authorization.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token.trim();
}

export async function getCurrentSupabaseUser(authorization?: string) {
  const accessToken = getBearerToken(authorization);
  if (!accessToken) {
    throw new Error("missing_bearer_token");
  }

  const supabase = createSupabaseAnonClient();
  const { data, error } = await supabase.auth.getUser(accessToken);

  if (error || !data.user) {
    throw new Error("invalid_auth_token");
  }

  return data.user;
}
