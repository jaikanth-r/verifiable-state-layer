import type { Authenticator } from "./authentication.js";
import type { AuthContext } from "./auth-context.js";

const DEV_USERS: Record<string, AuthContext> = {
  "dev-token": {
    userId: "66d5c5fc-c3c4-4e8b-94d3-d4c8c13f666f",
    tenantId: "2a46cf83-111b-4469-9bca-5e16196541f9",
    role: "owner"
  },
  "tenant-b-token": {
    userId: "309b65f0-328f-4bfa-bca2-7d6ff380b975",
    tenantId: "57ae30c0-ec66-4103-9fa3-c0a04063f2dc",
    role: "owner"
  }
};

export class DevelopmentAuthenticator implements Authenticator {
  async authenticate(
    authorizationHeader: string | undefined
  ): Promise<AuthContext | null> {
    if (!authorizationHeader?.startsWith("Bearer ")) {
      return null;
    }

    const token = authorizationHeader.slice("Bearer ".length);

    return DEV_USERS[token] ?? null;
  }
}
