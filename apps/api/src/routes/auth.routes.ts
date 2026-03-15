import type { FastifyInstance } from "fastify";
import { getCurrentSupabaseUser } from "../lib/currentUser";
import { loadSeedSession, saveSeedSession } from "../lib/devSessionStore";

export async function authRoutes(app: FastifyInstance) {
  app.get("/auth/me", async (request, reply) => {
    try {
      const user = await getCurrentSupabaseUser(request.headers.authorization);

      return {
        id: user.id,
        email: user.email ?? null
      };
    } catch (error) {
      console.error("Failed to resolve current auth user", error);
      reply.code(401);
      return { error: "unauthorized" };
    }
  });

  app.post<{ Body: { accessToken?: string } }>("/auth/dev-session", async (request, reply) => {
    try {
      const accessToken = request.body?.accessToken?.trim();
      if (!accessToken) {
        reply.code(400);
        return { error: "missing_access_token" };
      }

      const user = await getCurrentSupabaseUser(`Bearer ${accessToken}`);
      await saveSeedSession({
        accessToken,
        userId: user.id,
        email: user.email ?? null,
        updatedAt: new Date().toISOString()
      });

      return {
        ok: true,
        id: user.id,
        email: user.email ?? null
      };
    } catch (error) {
      console.error("Failed to cache dev auth session", error);
      reply.code(400);
      return { error: "dev_session_cache_failed" };
    }
  });

  app.get("/auth/dev-session", async (_request, reply) => {
    const session = await loadSeedSession();
    if (!session) {
      reply.code(404);
      return { error: "dev_session_not_found" };
    }

    return session;
  });
}
