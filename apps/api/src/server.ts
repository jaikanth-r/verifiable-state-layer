import Fastify from "fastify";
import cors from "@fastify/cors";
import { resourceRoutes } from "./routes/resources.js";
import { evidenceRoutes } from "./routes/evidence.js";
import { historyRoutes } from "./routes/history.js";
import { batchRoutes } from "./routes/batches.js";
import { verificationRoutes } from "./routes/verification.js";

export function buildServer() {
  const app = Fastify({
    logger: true
  });

  app.register(cors, {
    origin: true
  });

  app.register(resourceRoutes);
  app.register(evidenceRoutes);
  app.register(historyRoutes);
  app.register(batchRoutes);
  app.register(verificationRoutes);

  app.get("/health", async () => {
    return {
      status: "ok",
      service: "vsl-api",
      timestamp: new Date().toISOString()
    };
  });

  return app;
}
