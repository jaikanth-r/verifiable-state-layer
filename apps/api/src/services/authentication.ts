import type { AuthContext } from "./auth-context.js";

export interface Authenticator {
  authenticate(
    authorizationHeader: string | undefined
  ): Promise<AuthContext | null>;
}
