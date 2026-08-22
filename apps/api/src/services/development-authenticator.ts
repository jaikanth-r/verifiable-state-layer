import type { Authenticator } from "./authentication.js";
import { resolveAuthContext } from "./identity-resolver.js";

const DEV_TOKENS: Record<string, string> = {
  "dev-token": "dev-admin",
  "tenant-b-token": "tenant-b-user",
  "dev-admin-token": "dev-admin-user",
  "dev-member-token": "dev-member-user"
};

export class DevelopmentAuthenticator implements Authenticator {
  async authenticate(
    authorizationHeader: string | undefined
  ) {
    if (!authorizationHeader?.startsWith("Bearer ")) {
      return null;
    }

    const token = authorizationHeader.slice("Bearer ".length);
    const externalSubject = DEV_TOKENS[token];

    if (!externalSubject) {
      return null;
    }

    return resolveAuthContext(externalSubject);
  }
}
