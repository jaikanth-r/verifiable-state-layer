import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { createResource } from "../services/resource-service.js";

const createResourceSchema = z.object({
  resourceType: z.string().min(1).max(100),
  externalId: z.string().min(1).max(255).optional()
});

export async function resourceRoutes(app: FastifyInstance) {
  app.post("/v1/resources", async (request, reply) => {
    const parsed = createResourceSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({
        error: "INVALID_REQUEST",
        details: parsed.error.flatten()
      });
    }

    const resource = await createResource(parsed.data);

    return reply.code(201).send(resource);
  });
}
