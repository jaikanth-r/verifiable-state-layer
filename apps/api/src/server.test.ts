import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { buildServer } from "./server.js";

describe("API security boundary", () => {
  let app: ReturnType<typeof buildServer>;

  beforeEach(async () => {
    process.env.DATABASE_URL ??=
      "postgresql://vsl:vsl_dev_password@127.0.0.1:5432/vsl";
    process.env.AUTH_MODE = "development";

    app = buildServer({
      rateLimitMax: 2,
      rateLimitWindow: "1 minute"
    });

    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it("exposes public health and readiness", async () => {
    const health = await app.inject({
      method: "GET",
      url: "/health"
    });

    expect(health.statusCode).toBe(200);

    const ready = await app.inject({
      method: "GET",
      url: "/ready"
    });

    expect([200, 503]).toContain(ready.statusCode);
  });

  it("rejects unauthenticated protected requests", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/v1/resources",
      payload: {
        resourceType: "purchase",
        externalId: "security-test-001"
      }
    });

    expect(response.statusCode).toBe(401);
  });

  it("adds security headers", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/health"
    });

    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers["x-frame-options"]).toBeDefined();
  });

  it("enforces a request rate limit", async () => {
    const url =
      "/v1/batches/00000000-0000-4000-8000-000000000001";

    const headers = {
      authorization: "Bearer dev-member-token"
    };

    const first = await app.inject({
      method: "GET",
      url,
      headers
    });

    const second = await app.inject({
      method: "GET",
      url,
      headers
    });

    const third = await app.inject({
      method: "GET",
      url,
      headers
    });

    expect(first.statusCode).toBe(404);
    expect(second.statusCode).toBe(404);
    expect(third.statusCode).toBe(429);
  });
});
