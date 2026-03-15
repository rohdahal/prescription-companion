import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

dotenv.config({ path: path.join(projectRoot, ".env.local") });

function getArg(name) {
  const flag = `--${name}`;
  const index = process.argv.indexOf(flag);
  if (index === -1) {
    return undefined;
  }

  return process.argv[index + 1];
}

async function resolveAccessToken() {
  const directToken = getArg("access-token") ?? process.env.DEMO_SEED_ACCESS_TOKEN;
  if (directToken) {
    return directToken;
  }

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
  const cachedSessionResponse = await fetch(`${apiBaseUrl}/v1/auth/dev-session`).catch(() => null);
  if (cachedSessionResponse?.ok) {
    const cachedSession = await cachedSessionResponse.json();
    if (cachedSession?.accessToken) {
      return cachedSession.accessToken;
    }
  }

  const email = getArg("email") ?? process.env.DEMO_SEED_EMAIL;
  const password = getArg("password") ?? process.env.DEMO_SEED_PASSWORD;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!email || !password || !supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "No cached browser session found. Sign into the web app first, or provide --access-token / DEMO_SEED_ACCESS_TOKEN, or fall back to --email/--password."
    );
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.session?.access_token) {
    throw new Error(`Unable to sign in for seeding: ${error?.message ?? "missing access token"}`);
  }

  return data.session.access_token;
}

async function main() {
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
  const accessToken = await resolveAccessToken();

  const meResponse = await fetch(`${apiBaseUrl}/v1/auth/me`, {
    headers: {
      authorization: `Bearer ${accessToken}`
    }
  });

  if (!meResponse.ok) {
    throw new Error(`Failed to resolve current user (${meResponse.status})`);
  }

  const me = await meResponse.json();

  const seedResponse = await fetch(`${apiBaseUrl}/v1/demo/seed`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`
    }
  });

  if (!seedResponse.ok) {
    const failure = await seedResponse.text();
    throw new Error(`Demo seed failed (${seedResponse.status}): ${failure}`);
  }

  const result = await seedResponse.json();

  console.log(`Seeded demo data for user ${me.id}${me.email ? ` (${me.email})` : ""}`);
  console.log(`Prescription ID: ${result.prescriptionId}`);
  console.log(`Schedule ID: ${result.scheduleId ?? "n/a"}`);
  console.log(`Counts: ${JSON.stringify(result.counts)}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
