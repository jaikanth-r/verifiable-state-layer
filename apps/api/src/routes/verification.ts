import type { FastifyInstance } from "fastify";
import { merkleVerifier } from "../services/vsl-services.js";

export async function verificationRoutes(app: FastifyInstance) {
  app.get("/v1/verify/:eventId", async (request, reply) => {
    const { eventId } = request.params as { eventId: string };

    const result = await merkleVerifier.verifyEvent(
      request.auth.tenantId,
      eventId
    );

    return reply.send(result);
  });
}
