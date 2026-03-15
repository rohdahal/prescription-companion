import path from "node:path";
import { readFile, writeFile } from "node:fs/promises";

const sessionCachePath = path.resolve(process.cwd(), ".seed-session.json");

type CachedSeedSession = {
  accessToken: string;
  userId: string;
  email: string | null;
  updatedAt: string;
};

export async function saveSeedSession(session: CachedSeedSession) {
  await writeFile(sessionCachePath, `${JSON.stringify(session, null, 2)}\n`, "utf8");
}

export async function loadSeedSession(): Promise<CachedSeedSession | null> {
  try {
    const payload = await readFile(sessionCachePath, "utf8");
    return JSON.parse(payload) as CachedSeedSession;
  } catch {
    return null;
  }
}
