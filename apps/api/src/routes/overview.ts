import type { FastifyInstance } from "fastify";

import { requireRole } from "../services/authorization.js";
import { getOverview } from "../services/overview-service.js";

export async function overviewRoutes(app: FastifyInstance) {
  app.get("/v1/overview", async (request, reply) => {
    requireRole(request.auth, "member");

    const overview = await getOverview(request.auth);

    return reply.send(overview);
  });
}
