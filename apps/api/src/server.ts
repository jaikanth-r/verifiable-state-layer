import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";

import { resourceRoutes } from "./routes/resources.js";
import { evidenceRoutes } from "./routes/evidence.js";
import { historyRoutes } from "./routes/history.js";
import { batchRoutes } from "./routes/batches.js";
import { verificationRoutes } from "./routes/verification.js";
import { registerRequestContext } from "./services/request-context.js";

export interface ServerOptions {
  rateLimitMax?: number;
  rateLimitWindow?: string | number;
}

export function buildServer(options: ServerOptions = {}) {
  const app = Fastify({
    logger: true
  });

  registerRequestContext(app);

  const allowedOrigins = (process.env.CORS_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.register(cors, {
    origin:
      allowedOrigins.length > 0
        ? allowedOrigins
        : ["http://127.0.0.1:5173", "http://localhost:5173"],
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    maxAge: 600
  });

  app.register(helmet, {
    global: true
  });

  app.get("/health", async () => {
    return {
      status: "ok",
      service: "vsl-api",
      timestamp: new Date().toISOString()
    };
  });

  app.get("/ready", async (request, reply) => {
    try {
      const { pool } = await import("./config/database.js");
      await pool.query("SELECT 1");

      return {
        status: "ready",
        service: "vsl-api",
        database: "ok",
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      request.log.error(error);

      return reply.code(503).send({
        status: "not_ready",
        service: "vsl-api",
        database: "unavailable"
      });
    }
  });

  app.register(async (scope) => {
    await scope.register(rateLimit, {
      global: true,
      hook: "preHandler",
      max: options.rateLimitMax ?? Number(process.env.RATE_LIMIT_MAX ?? 120),
      timeWindow:
        options.rateLimitWindow ??
        process.env.RATE_LIMIT_WINDOW ??
        "1 minute"
    });

    await scope.register(resourceRoutes);
    await scope.register(evidenceRoutes);
    await scope.register(historyRoutes);
    await scope.register(batchRoutes);
    await scope.register(verificationRoutes);
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return reply.code(403).send({
        error: "FORBIDDEN"
      });
    }

    if (
      typeof error === "object" &&
      error !== null &&
      "statusCode" in error &&
      error.statusCode === 429
    ) {
      return reply.code(429).send({
        error: "RATE_LIMITED"
      });
    }

    request.log.error(error);

    return reply.code(500).send({
      error: "INTERNAL_SERVER_ERROR"
    });
  });

  return app;
}
