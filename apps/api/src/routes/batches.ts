import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { servicesPromise } from "../services/application.js";

const createBatchSchema = z.object({
  batchSize: z.number().int().positive().max(1000).optional()
}).strict();

export async function batchRoutes(app: FastifyInstance) {
  app.post("/v1/batches", async (request, reply) => {
    const parsed = createBatchSchema.safeParse(request.body ?? {});

    if (!parsed.success) {
      return reply.code(400).send({
        error: "INVALID_REQUEST",
        details: parsed.error.flatten()
      });
    }

    const { batchService } = await servicesPromise;

    const batch = await batchService.createPendingBatch(
      parsed.data.batchSize ?? 100
    );

    if (!batch) {
      return reply.code(204).send();
    }

    return reply.code(201).send(batch);
  });

  app.post("/v1/batches/:batchId/anchor", async (request, reply) => {
    const { batchId } = request.params as { batchId: string };

    const { batchService } = await servicesPromise;

    try {
      const batch = await batchService.anchorBatch(batchId);
      return reply.send(batch);
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.startsWith("Anchor batch not found")
      ) {
        return reply.code(404).send({
          error: "BATCH_NOT_FOUND"
        });
      }

      if (
        error instanceof Error &&
        error.message.includes("cannot be anchored from status")
      ) {
        return reply.code(409).send({
          error: "BATCH_NOT_ANCHORABLE",
          message: error.message
        });
      }

      throw error;
    }
  });

  app.get("/v1/batches/:batchId", async (request, reply) => {
    const { batchId } = request.params as { batchId: string };

    const { batchService } = await servicesPromise;

    const batch = await batchService.getBatch(batchId);

    if (!batch) {
      return reply.code(404).send({
        error: "BATCH_NOT_FOUND"
      });
    }

    return reply.send(batch);
  });
}
