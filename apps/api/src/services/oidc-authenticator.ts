import {
  createRemoteJWKSet,
  jwtVerify,
  type JWK,
  type JWTPayload,
  type JWTVerifyGetKey
} from "jose";

import type { Authenticator } from "./authentication.js";
import type { AuthContext } from "./auth-context.js";
import { getOidcConfig } from "./oidc-config.js";
import { resolveAuthContext } from "./identity-resolver.js";

interface OidcClaims extends JWTPayload {
  sub: string;
}

export interface OidcAuthenticatorOptions {
  issuer?: string;
  audience?: string;
  jwks?: JWTVerifyGetKey;
}

export class OidcAuthenticator implements Authenticator {
  private readonly issuer: string;
  private readonly audience: string;
  private readonly jwks: JWTVerifyGetKey;

  constructor(options: OidcAuthenticatorOptions = {}) {
    const config = getOidcConfig();

    this.issuer = options.issuer ?? config.issuer;
    this.audience = options.audience ?? config.audience;
    this.jwks =
      options.jwks ??
      createRemoteJWKSet(new URL(config.jwksUrl));
  }

  async authenticate(
    authorizationHeader: string | undefined
  ): Promise<AuthContext | null> {
    if (!authorizationHeader?.startsWith("Bearer ")) {
      return null;
    }

    const token = authorizationHeader.slice("Bearer ".length).trim();

    if (!token) {
      return null;
    }

    try {
      const { payload } = await jwtVerify<OidcClaims>(
        token,
        this.jwks,
        {
          issuer: this.issuer,
          audience: this.audience
        }
      );

      if (!payload.sub) {
        return null;
      }

      return await resolveAuthContext(payload.sub);
    } catch (error) {
      console.error("[VSL OIDC AUTH FAILURE]", {
        error:
          error instanceof Error
            ? {
                name: error.name,
                message: error.message
              }
            : String(error),
        issuer: this.issuer,
        audience: this.audience
      });

      return null;
    }
  }
}
