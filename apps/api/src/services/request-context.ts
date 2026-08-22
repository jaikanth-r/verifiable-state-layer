import type { FastifyInstance } from "fastify";
import type { AuthContext } from "./auth-context.js";
import { createAuthenticator } from "./authenticator-factory.js";

declare module "fastify" {
  interface FastifyRequest {
    auth: AuthContext;
  }
}

const authenticator = createAuthenticator();

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
      return reply.code(401).send({
        error: "UNAUTHENTICATED"
      });
    }

    request.auth = auth;
  });
}
