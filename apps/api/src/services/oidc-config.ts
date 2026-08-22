export interface OidcConfig {
  issuer: string;
  audience: string;
  jwksUrl: string;
}

export function getOidcConfig(): OidcConfig {
  const issuer = process.env.OIDC_ISSUER;
  const audience = process.env.OIDC_AUDIENCE;
  const jwksUrl = process.env.OIDC_JWKS_URL;

  if (!issuer || !audience || !jwksUrl) {
    throw new Error(
      "OIDC configuration is incomplete: OIDC_ISSUER, OIDC_AUDIENCE, and OIDC_JWKS_URL are required"
    );
  }

  return {
    issuer,
    audience,
    jwksUrl
  };
}
