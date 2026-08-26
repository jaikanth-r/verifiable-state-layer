import { afterEach, describe, expect, it } from "vitest";

import { createAuthenticator } from "./authenticator-factory.js";
import { DevelopmentAuthenticator } from "./development-authenticator.js";

describe("createAuthenticator", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalAuthMode = process.env.AUTH_MODE;

  afterEach(() => {
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }

    if (originalAuthMode === undefined) {
      delete process.env.AUTH_MODE;
    } else {
      process.env.AUTH_MODE = originalAuthMode;
    }
  });

  it("fails closed in production when AUTH_MODE is missing", () => {
    process.env.NODE_ENV = "production";
    delete process.env.AUTH_MODE;

    expect(() => createAuthenticator()).toThrow(
      "AUTH_MODE is required when NODE_ENV=production"
    );
  });

  it("rejects development authentication in production", () => {
    process.env.NODE_ENV = "production";
    process.env.AUTH_MODE = "development";

    expect(() => createAuthenticator()).toThrow(
      "AUTH_MODE=development is not allowed when NODE_ENV=production"
    );
  });

  it("uses development authentication when development mode has no AUTH_MODE", () => {
    process.env.NODE_ENV = "development";
    delete process.env.AUTH_MODE;

    expect(createAuthenticator()).toBeInstanceOf(
      DevelopmentAuthenticator
    );
  });
});
