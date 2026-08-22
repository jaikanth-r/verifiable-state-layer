import type { FastifyInstance } from "fastify";
import type { AuthContext } from "./auth-context.js";
import { createAuthenticator } from "./authenticator-factory.js";
import { PostgresAuditWriter } from "./postgres-audit-writer.js";

declare module "fastify" {
  interface FastifyRequest {
    auth: AuthContext;
  }
}

const authenticator = createAuthenticator();
const auditWriter = new PostgresAuditWriter();

export function registerRequestContext(
  app: FastifyInstance
) {
  app.addHook("onRequest", async (request, reply) => {
    if (request.url === "/health" || request.url === "/ready") {
      return;
    }

    const auth = await authenticator.authenticate(
      request.headers.authorization
    );

    if (!auth) {
      try {
        await auditWriter.write({
          action: "AUTHENTICATION_FAILED",
          outcome: "failure",
          requestId: request.id,
          metadata: {
            method: request.method,
            url: request.url
          }
        });
      } catch (error) {
        request.log.error(error);
      }

      return reply.code(401).send({
        error: "UNAUTHENTICATED"
      });
    }

    request.auth = auth;
  });
}
