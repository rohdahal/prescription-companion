import type { FastifyInstance } from "fastify";
import { seedDemoDataForUser } from "../lib/demoSeed";
import { getCurrentSupabaseUser } from "../lib/currentUser";

export async function demoRoutes(app: FastifyInstance) {
  app.post("/demo/seed", async (request, reply) => {
    try {
      const user = await getCurrentSupabaseUser(request.headers.authorization);
      const result = await seedDemoDataForUser({
        userId: user.id,
        email: user.email ?? null
      });

      return result;
    } catch (error) {
      console.error("Demo seeding failed", error);
      reply.code(400);
      return { error: "demo_seed_failed" };
    }
  });
}
