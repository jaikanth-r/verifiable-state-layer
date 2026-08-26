import type { FastifyInstance } from "fastify";

import { z } from "zod";

import {
  createResource,
  listResources
} from "../services/resource-service.js";

import { requireRole } from "../services/authorization.js";

const createResourceSchema = z.object({
  resourceType: z
    .string()
    .trim()
    .min(1)
    .max(100)
});

export async function resourceRoutes(app: FastifyInstance) {
  app.get("/v1/resources", async (request, reply) => {
    requireRole(request.auth, "member");

    const resources = await listResources(request.auth);

    return reply.send({
      items: resources
    });
  });

  app.post("/v1/resources", async (request, reply) => {
    requireRole(request.auth, "member");

    const parsed = createResourceSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({
        error: "INVALID_REQUEST",
        details: parsed.error.flatten()
      });
    }

    try {
      const resource = await createResource(
        request.auth,
        parsed.data,
        request.id
      );

      return reply.code(201).send(resource);
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes("already exists")
      ) {
        return reply.code(409).send({
          error: "RESOURCE_ALREADY_EXISTS",
          message: error.message
        });
      }

      throw error;
    }
  });
}
