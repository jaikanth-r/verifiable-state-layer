import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireRole } from "../services/authorization.js";
import {
  addParticipant,
  listParticipants
} from "../services/resource-participant-service.js";

const resourceIdParamSchema = z.object({
  resourceId: z.string().uuid()
}).strict();

const addParticipantSchema = z.object({
  tenantId: z.string().uuid(),
  role: z.enum([
    "counterparty",
    "carrier",
    "inspector",
    "other"
  ])
}).strict();

export async function resourceParticipantRoutes(
  app: FastifyInstance
) {
  app.post(
    "/v1/resources/:resourceId/participants",
    async (request, reply) => {
      requireRole(request.auth, "owner");

      const parsedParams = resourceIdParamSchema.safeParse(
        request.params
      );
      if (!parsedParams.success) {
        return reply.code(400).send({
          error: "INVALID_REQUEST",
          details: parsedParams.error.flatten()
        });
      }

      const parsed = addParticipantSchema.safeParse(
        request.body
      );

      if (!parsed.success) {
        return reply.code(400).send({
          error: "INVALID_REQUEST",
          details: parsed.error.flatten()
        });
      }

      try {
        const participant = await addParticipant(
          request.auth,
          parsedParams.data.resourceId,
          parsed.data.tenantId,
          parsed.data.role,
          request.id
        );

        return reply.code(201).send(participant);
      } catch (error) {
        if (
          error instanceof Error &&
          error.message === "FORBIDDEN"
        ) {
          return reply.code(403).send({
            error: "FORBIDDEN"
          });
        }

        if (
          error instanceof Error &&
          error.message === "Resource not found"
        ) {
          return reply.code(404).send({
            error: "RESOURCE_NOT_FOUND"
          });
        }

        if (
          error instanceof Error &&
          error.message === "Tenant not found"
        ) {
          return reply.code(404).send({
            error: "TENANT_NOT_FOUND"
          });
        }

        if (
          error instanceof Error &&
          error.message.includes(
            "already a participant"
          )
        ) {
          return reply.code(409).send({
            error: "PARTICIPANT_ALREADY_EXISTS"
          });
        }

        throw error;
      }
    }
  );

  app.get(
    "/v1/resources/:resourceId/participants",
    async (request, reply) => {
      const parsedParams = resourceIdParamSchema.safeParse(
        request.params
      );
      if (!parsedParams.success) {
        return reply.code(400).send({
          error: "INVALID_REQUEST",
          details: parsedParams.error.flatten()
        });
      }

      try {
        const participants =
          await listParticipants(
            request.auth,
            parsedParams.data.resourceId
          );

        return reply.send({
          resourceId: parsedParams.data.resourceId,
          participants
        });
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
