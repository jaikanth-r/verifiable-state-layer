import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  createEvent,
  protectEvidence
} from "../services/evidence-service.js";
import { requireRole } from "../services/authorization.js";

const resourceIdParamSchema = z.object({
  resourceId: z.string().uuid()
}).strict();

const createEventSchema = z.object({
  eventType: z.enum([
    "create",
    "update",
    "amend",
    "approve",
    "complete",
    "revoke"
  ]),
  state: z.record(z.string(), z.unknown())
}).strict();

export async function evidenceRoutes(app: FastifyInstance) {
  app.post(
    "/v1/resources/:resourceId/protect",
    async (request, reply) => {
      requireRole(request.auth, "member");

      const parsedParams = resourceIdParamSchema.safeParse(request.params);
      if (!parsedParams.success) {
        return reply.code(400).send({
          error: "INVALID_REQUEST",
          details: parsedParams.error.flatten()
        });
      }

      const { resourceId } = parsedParams.data;

      try {
        const result = await protectEvidence(
          request.auth,
          resourceId,
          request.id
        );

        return reply.send(result);
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

  app.post(
    "/v1/resources/:resourceId/events",
    async (request, reply) => {
      requireRole(request.auth, "member");
      const parsedParams = resourceIdParamSchema.safeParse(request.params);
      if (!parsedParams.success) {
        return reply.code(400).send({
          error: "INVALID_REQUEST",
          details: parsedParams.error.flatten()
        });
      }

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
          parsedParams.data.resourceId,
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
