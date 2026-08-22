import {
  exportJWK,
  generateKeyPair,
  SignJWT,
  createLocalJWKSet
} from "jose";

import { beforeAll, describe, expect, it, vi } from "vitest";

import { OidcAuthenticator } from "./oidc-authenticator.js";

const ISSUER = "https://issuer.example.test";
const AUDIENCE = "vsl-api";
const KEY_ID = "vsl-test-key";

let privateKey: CryptoKey;
let jwks: ReturnType<typeof createLocalJWKSet>;

vi.mock("./oidc-config.js", () => ({
  getOidcConfig: () => ({
    issuer: ISSUER,
    audience: AUDIENCE,
    jwksUrl: "https://issuer.example.test/.well-known/jwks.json"
  })
}));

vi.mock("./identity-resolver.js", () => ({
  resolveAuthContext: vi.fn(async (subject: string) => {
    if (subject === "dev-member-user") {
      return {
        userId: "user-001",
        tenantId: "tenant-001",
        role: "member" as const
      };
    }

    return null;
  })
}));

async function createToken(
  subject: string,
  options: {
    issuer?: string;
    audience?: string;
  } = {}
) {
  return new SignJWT({})
    .setProtectedHeader({
      alg: "RS256",
      kid: KEY_ID
    })
    .setIssuer(options.issuer ?? ISSUER)
    .setAudience(options.audience ?? AUDIENCE)
    .setSubject(subject)
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(privateKey);
}

beforeAll(async () => {
  const keys = await generateKeyPair("RS256");

  privateKey = keys.privateKey;

  const publicJwk = {
    ...(await exportJWK(keys.publicKey)),
    kid: KEY_ID,
    alg: "RS256",
    use: "sig"
  };

  jwks = createLocalJWKSet({
    keys: [publicJwk]
  });
});

describe("OidcAuthenticator", () => {
  it("rejects missing authorization", async () => {
    const authenticator = new OidcAuthenticator({
      issuer: ISSUER,
      audience: AUDIENCE,
      jwks
    });

    expect(await authenticator.authenticate(undefined)).toBeNull();
  });

  it("rejects malformed authorization", async () => {
    const authenticator = new OidcAuthenticator({
      issuer: ISSUER,
      audience: AUDIENCE,
      jwks
    });

    expect(
      await authenticator.authenticate("Basic abc")
    ).toBeNull();
  });

  it("accepts a valid JWT and resolves its subject", async () => {
    const authenticator = new OidcAuthenticator({
      issuer: ISSUER,
      audience: AUDIENCE,
      jwks
    });

    const token = await createToken("dev-member-user");

    await expect(
      authenticator.authenticate(`Bearer ${token}`)
    ).resolves.toEqual({
      userId: "user-001",
      tenantId: "tenant-001",
      role: "member"
    });
  });

  it("rejects a token with the wrong issuer", async () => {
    const authenticator = new OidcAuthenticator({
      issuer: ISSUER,
      audience: AUDIENCE,
      jwks
    });

    const token = await createToken("dev-member-user", {
      issuer: "https://attacker.example.test"
    });

    await expect(
      authenticator.authenticate(`Bearer ${token}`)
    ).resolves.toBeNull();
  });

  it("rejects a token with the wrong audience", async () => {
    const authenticator = new OidcAuthenticator({
      issuer: ISSUER,
      audience: AUDIENCE,
      jwks
    });

    const token = await createToken("dev-member-user", {
      audience: "different-api"
    });

    await expect(
      authenticator.authenticate(`Bearer ${token}`)
    ).resolves.toBeNull();
  });

  it("rejects an unknown subject", async () => {
    const authenticator = new OidcAuthenticator({
      issuer: ISSUER,
      audience: AUDIENCE,
      jwks
    });

    const token = await createToken("unknown-user");

    await expect(
      authenticator.authenticate(`Bearer ${token}`)
    ).resolves.toBeNull();
  });
});
