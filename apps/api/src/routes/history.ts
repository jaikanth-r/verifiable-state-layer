import type { FastifyInstance } from "fastify";
import { getResourceHistory } from "../services/history-service.js";

export async function historyRoutes(app: FastifyInstance) {
  app.get(
    "/v1/resources/:resourceId/history",
    async (request, reply) => {
      const { resourceId } = request.params as {
        resourceId: string;
      };

      try {
        const history = await getResourceHistory(
          request.auth,
          resourceId
        );

        return reply.send({
          resourceId,
          versions: history
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
