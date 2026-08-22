import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { requireRole } from "../services/authorization.js";
import { queryAuditEvents } from "../services/audit-query-service.js";

const auditQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  action: z.string().min(1).max(100).optional(),
  outcome: z.enum(["success", "failure", "denied"]).optional(),
  userId: z.string().uuid().optional(),
  resourceId: z.string().uuid().optional(),
  requestId: z.string().min(1).max(255).optional()
}).strict();

export async function auditRoutes(app: FastifyInstance) {
  app.get("/v1/audit", async (request, reply) => {
    requireRole(request.auth, "admin");

    const parsed = auditQuerySchema.safeParse(request.query);

    if (!parsed.success) {
      return reply.code(400).send({
        error: "INVALID_REQUEST",
        details: parsed.error.flatten()
      });
    }

    const page = await queryAuditEvents(
      request.auth,
      parsed.data
    );

    return reply.send(page);
  });
}
