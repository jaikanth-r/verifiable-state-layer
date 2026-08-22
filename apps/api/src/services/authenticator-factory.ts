import type { Authenticator } from "./authentication.js";
import { DevelopmentAuthenticator } from "./development-authenticator.js";

export function createAuthenticator(): Authenticator {
  const mode = process.env.AUTH_MODE ?? "development";

  switch (mode) {
    case "development":
      return new DevelopmentAuthenticator();

    default:
      throw new Error(`Unsupported AUTH_MODE: ${mode}`);
  }
}
