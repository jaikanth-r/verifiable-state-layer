import type { AuthProviderProps } from "react-oidc-context";

const issuer = import.meta.env.VITE_OIDC_ISSUER;
const clientId = import.meta.env.VITE_OIDC_CLIENT_ID;

if (!issuer || !clientId) {
  throw new Error(
    "OIDC configuration is incomplete: VITE_OIDC_ISSUER and VITE_OIDC_CLIENT_ID are required"
  );
}

export const oidcConfig: AuthProviderProps = {
  authority: issuer,
  client_id: clientId,
  redirect_uri: `${window.location.origin}/auth/callback`,
  post_logout_redirect_uri: window.location.origin,
  response_type: "code",
  scope:
    "openid profile email urn:zitadel:iam:org:project:id:388463459739777871:aud",
  automaticSilentRenew: true
};
