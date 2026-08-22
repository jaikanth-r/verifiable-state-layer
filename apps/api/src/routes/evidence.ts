import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { createEvent } from "../services/evidence-service.js";
import { requireRole } from "../services/authorization.js";

const createEventSchema = z.object({
  eventType: z.enum([
    "create",
    "update",
    "amend",
    "approve",
    "complete",
    "revoke"
  ]),
  actorId: z.string().min(1).max(255),
  timestamp: z.string().datetime(),
  state: z.record(z.string(), z.unknown())
}).strict();

export async function evidenceRoutes(app: FastifyInstance) {
  app.post(
    "/v1/resources/:resourceId/events",
    async (request, reply) => {
      requireRole(request.auth, "member");
      const parsed = createEventSchema.safeParse(request.body);

      if (!parsed.success) {
        return reply.code(400).send({
          error: "INVALID_REQUEST",
          details: parsed.error.flatten()
        });
      }

      try {
        const event = await createEvent(
          request.auth,
          (request.params as { resourceId: string }).resourceId,
          parsed.data,
          request.id
        );

        return reply.code(201).send(event);
      } catch (error) {
        if (
          error instanceof Error &&
          error.message === "Resource not found"
        ) {
          return reply.code(404).send({
            error: "RESOURCE_NOT_FOUND"
          });
        }

        throw error;
      }
    }
  );
}
