import type { FastifyInstance } from "fastify";
import { getResourceHistory } from "../services/history-service.js";

export async function historyRoutes(app: FastifyInstance) {
  app.get(
    "/v1/resources/:resourceId/history",
    async (request, reply) => {
      const { resourceId } = request.params as {
        resourceId: string;
      };

      const history = await getResourceHistory(resourceId);

      return reply.send({
        resourceId,
        versions: history
      });
    }
  );
}
