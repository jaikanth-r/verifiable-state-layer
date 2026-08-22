import type { Authenticator } from "./authentication.js";
import { DevelopmentAuthenticator } from "./development-authenticator.js";
import { OidcAuthenticator } from "./oidc-authenticator.js";

export function createAuthenticator(): Authenticator {
  const mode = process.env.AUTH_MODE ?? "development";

  switch (mode) {
    case "development":
      return new DevelopmentAuthenticator();

    case "oidc":
      return new OidcAuthenticator();

    default:
      throw new Error(`Unsupported AUTH_MODE: ${mode}`);
  }
}
