import type { FastifyInstance } from "fastify";

export async function demoRoutes(app: FastifyInstance) {
  app.post("/demo/seed", async (request, reply) => {
    try {
      const user = await app.services.getCurrentSupabaseUser(request.headers.authorization);
      const result = await app.services.seedDemoDataForUser({
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
