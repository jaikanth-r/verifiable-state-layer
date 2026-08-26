import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { merkleVerifier } from "../services/vsl-services.js";
import { requireEventAccess } from "../services/event-access.js";

const eventIdParamSchema = z.object({
  eventId: z.string().uuid()
}).strict();

export async function verificationRoutes(app: FastifyInstance) {
  app.get("/v1/verify/:eventId", async (request, reply) => {
    const parsedParams = eventIdParamSchema.safeParse(request.params);
    if (!parsedParams.success) {
      return reply.code(400).send({
        error: "INVALID_REQUEST",
        details: parsedParams.error.flatten()
      });
    }

    const { eventId } = parsedParams.data;

    try {
      const access = await requireEventAccess(
        request.auth,
        eventId
      );

      const result = await merkleVerifier.verifyEvent(
        access.ownerTenantId,
        eventId
      );

      return reply.send(result);
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "Event not found"
      ) {
        return reply.code(404).send({
          error: "EVENT_NOT_FOUND"
        });
      }

      if (
        error instanceof Error &&
        error.message === "Resource not found"
      ) {
        return reply.code(404).send({
          error: "EVENT_NOT_FOUND"
        });
      }

      throw error;
    }
  });
}
