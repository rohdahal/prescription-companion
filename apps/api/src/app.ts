import fastify from "fastify";
import multipart from "@fastify/multipart";
import { apiPlugin } from "./plugins/api";
import { defaultAppServices, type AppServices } from "./lib/services";

declare module "fastify" {
  interface FastifyInstance {
    services: AppServices;
  }
}

export function buildApp(overrides?: Partial<AppServices>) {
  const app = fastify({ logger: true });

  app.decorate("services", {
    ...defaultAppServices,
    ...overrides
  });

  app.register(multipart);
  app.register(apiPlugin);

  return app;
}
