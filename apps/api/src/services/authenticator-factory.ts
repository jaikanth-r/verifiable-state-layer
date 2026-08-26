import type { Authenticator } from "./authentication.js";
import { DevelopmentAuthenticator } from "./development-authenticator.js";
import { OidcAuthenticator } from "./oidc-authenticator.js";

export function createAuthenticator(): Authenticator {
  const nodeEnv = process.env.NODE_ENV ?? "development";
  const mode = process.env.AUTH_MODE;

  if (!mode) {
    if (nodeEnv === "production") {
      throw new Error(
        "AUTH_MODE is required when NODE_ENV=production"
      );
    }

    return new DevelopmentAuthenticator();
  }

  switch (mode) {
    case "development":
      return new DevelopmentAuthenticator();

    case "oidc":
      return new OidcAuthenticator();

    default:
      throw new Error(`Unsupported AUTH_MODE: ${mode}`);
  }
}
