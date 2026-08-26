import type { FastifyInstance } from "fastify";
import { getResourceHistory } from "../services/history-service.js";
import { z } from "zod";

const resourceIdParamSchema = z.object({
  resourceId: z.string().uuid()
}).strict();

export async function historyRoutes(app: FastifyInstance) {
  app.get(
    "/v1/resources/:resourceId/history",
    async (request, reply) => {
      const parsedParams = resourceIdParamSchema.safeParse(request.params);
      if (!parsedParams.success) {
        return reply.code(400).send({
          error: "INVALID_REQUEST",
          details: parsedParams.error.flatten()
        });
      }

      const { resourceId } = parsedParams.data;

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
