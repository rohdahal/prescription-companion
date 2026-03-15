import type { FastifyInstance } from "fastify";
import { healthRoutes } from "../routes/health.routes";
import { prescriptionsRoutes } from "../routes/prescriptions.routes";
import { chatRoutes } from "../routes/chat.routes";
import { scheduleRoutes } from "../routes/schedule.routes";
import { remindersRoutes } from "../routes/reminders.routes";
import { authRoutes } from "../routes/auth.routes";
import { demoRoutes } from "../routes/demo.routes";
import { careRoutes } from "../routes/care.routes";

export async function apiPlugin(app: FastifyInstance) {
  app.addHook("onRequest", async (_request, reply) => {
    reply.header("access-control-allow-origin", "*");
    reply.header("access-control-allow-methods", "GET,POST,OPTIONS");
    reply.header("access-control-allow-headers", "content-type,authorization");
  });

  app.options("*", async (_request, reply) => {
    reply.status(204).send();
  });

  app.register(healthRoutes);
  app.register(authRoutes, { prefix: "/v1" });
  app.register(demoRoutes, { prefix: "/v1" });
  app.register(prescriptionsRoutes, { prefix: "/v1" });
  app.register(chatRoutes, { prefix: "/v1" });
  app.register(scheduleRoutes, { prefix: "/v1" });
  app.register(careRoutes, { prefix: "/v1" });
  app.register(remindersRoutes, { prefix: "/v1" });
}
