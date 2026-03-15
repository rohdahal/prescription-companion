import path from "node:path";
import dotenv from "dotenv";
import { getOAuthApiKey } from "@prescription-companion/ai";
import { buildApp } from "./app";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), "../../.env.local"), override: false });

async function ensureCodexAuthOnStartup() {
  const shouldAuth = (process.env.CODEX_AUTH_ON_STARTUP ?? "true").toLowerCase() === "true";
  if (!shouldAuth) {
    return;
  }

  try {
    await getOAuthApiKey();
  } catch (error) {
    console.error("Codex auth failed during API startup", error);
    throw error;
  }
}

const app = buildApp();

const port = Number(process.env.BACKEND_PORT ?? 3001);

await ensureCodexAuthOnStartup();

app.listen({ port, host: "0.0.0.0" }).then(() => {
  console.log(`Prescription Companion API listening on http://localhost:${port}`);
});
