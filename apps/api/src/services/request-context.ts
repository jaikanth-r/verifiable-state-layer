import type { FastifyInstance } from "fastify";
import type { AuthContext } from "./auth-context.js";
import {
  DevelopmentAuthenticator
} from "./development-authenticator.js";

declare module "fastify" {
  interface FastifyRequest {
    auth: AuthContext;
  }
}

const authenticator = new DevelopmentAuthenticator();

export function registerRequestContext(
  app: FastifyInstance
) {
  app.addHook("onRequest", async (request, reply) => {
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
