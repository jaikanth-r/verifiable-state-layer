import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { buildServer } from "./server.js";
import { pool } from "./config/database.js";
import { resolveAuthContext } from "./services/identity-resolver.js";

describe("API security boundary", () => {
  let app: ReturnType<typeof buildServer>;

  beforeEach(async () => {
    process.env.DATABASE_URL ??=
      "postgresql://vsl:vsl_dev_password@127.0.0.1:5432/vsl";
    process.env.AUTH_MODE = "development";

    app = buildServer({
      rateLimitMax: 20,
      rateLimitWindow: "1 minute"
    });

    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it("requires explicit CORS origins in production", () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalCorsOrigins = process.env.CORS_ORIGINS;

    try {
      process.env.NODE_ENV = "production";
      delete process.env.CORS_ORIGINS;

      expect(() => buildServer()).toThrow(
        "CORS_ORIGINS is required when NODE_ENV=production"
      );
    } finally {
      if (originalNodeEnv === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = originalNodeEnv;
      }

      if (originalCorsOrigins === undefined) {
        delete process.env.CORS_ORIGINS;
      } else {
        process.env.CORS_ORIGINS = originalCorsOrigins;
      }
    }
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
    const rateLimitedApp = buildServer({
      rateLimitMax: 2,
      rateLimitWindow: "1 minute"
    });

    await rateLimitedApp.ready();

    try {
      const request = {
        method: "GET" as const,
        url: "/v1/batches/00000000-0000-4000-8000-000000000001",
        headers: {
          authorization: "Bearer dev-member-token"
        }
      };

      const first = await rateLimitedApp.inject(request);
      const second = await rateLimitedApp.inject(request);
      const third = await rateLimitedApp.inject(request);

      expect(first.statusCode).toBe(404);
      expect(second.statusCode).toBe(404);
      expect(third.statusCode).toBe(429);
    } finally {
      await rateLimitedApp.close();
    }
  });
  it("rejects malformed UUID path parameters", async () => {
    const requests = [
      {
        method: "GET" as const,
        url: "/v1/batches/not-a-uuid"
      },
      {
        method: "GET" as const,
        url: "/v1/resources/not-a-uuid/history"
      },
      {
        method: "GET" as const,
        url: "/v1/verify/not-a-uuid"
      },
      {
        method: "GET" as const,
        url: "/v1/resources/not-a-uuid/participants"
      }
    ];

    for (const request of requests) {
      const response = await app.inject({
        ...request,
        headers: {
          authorization: "Bearer dev-member-token"
        }
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({
        error: "INVALID_REQUEST"
      });
    }
  });

  it("generates tenant-scoped references from record type", async () => {
    const first = await app.inject({
      method: "POST",
      url: "/v1/resources",
      headers: {
        authorization: "Bearer dev-member-token"
      },
      payload: {
        resourceType: "Shipment"
      }
    });

    expect(first.statusCode).toBe(201);

    const firstResource = first.json<{
      resourceType: string;
      externalId: string;
    }>();

    expect(firstResource.resourceType).toBe("Shipment");
    expect(firstResource.externalId).toMatch(/^VSL-SHIPMENT-[0-9]{4}-[0-9]{6}$/);

    const second = await app.inject({
      method: "POST",
      url: "/v1/resources",
      headers: {
        authorization: "Bearer dev-member-token"
      },
      payload: {
        resourceType: "Shipment"
      }
    });

    expect(second.statusCode).toBe(201);

    const secondResource = second.json<{
      externalId: string;
    }>();

    expect(secondResource.externalId).toMatch(/^VSL-SHIPMENT-[0-9]{4}-[0-9]{6}$/);
    expect(secondResource.externalId).not.toBe(
      firstResource.externalId
    );

    const custom = await app.inject({
      method: "POST",
      url: "/v1/resources",
      headers: {
        authorization: "Bearer dev-member-token"
      },
      payload: {
        resourceType: "Pharmaceutical Batch Release"
      }
    });

    expect(custom.statusCode).toBe(201);

    const customResource = custom.json<{
      externalId: string;
    }>();

    expect(
      customResource.externalId.startsWith(
        "VSL-PHARMACEUTICAL-BATCH-RELEASE-"
      )
    ).toBe(true);

    expect(customResource.externalId).toMatch(
      /-[0-9]{4}-[0-9]{6}$/
    );
  });

  it("audits successful resource creation", async () => {
    const externalId = `audit-resource-${Date.now()}`;

    const response = await app.inject({
      method: "POST",
      url: "/v1/resources",
      headers: {
        authorization: "Bearer dev-member-token"
      },
      payload: {
        resourceType: "purchase",
        externalId
      }
    });

    expect(response.statusCode).toBe(201);

    const resource = response.json<{
      id: string;
    }>();

    const audit = await pool.query<{
      action: string;
      outcome: string;
      tenant_id: string;
      user_id: string;
      resource_id: string;
    }>(
      `
      SELECT
        action,
        outcome,
        tenant_id,
        user_id,
        resource_id
      FROM audit_events
      WHERE resource_id = $1
      ORDER BY occurred_at DESC
      LIMIT 1
      `,
      [resource.id]
    );

    const auth = await resolveAuthContext("dev-member-user");

    expect(auth).not.toBeNull();

    expect(audit.rows[0]).toMatchObject({
      action: "RESOURCE_CREATED",
      outcome: "success",
      tenant_id: auth!.tenantId,
      user_id: auth!.userId,
      resource_id: resource.id
    });
  });

  it("audits successful evidence creation", async () => {
    const externalId = `audit-evidence-${Date.now()}`;

    const resourceResponse = await app.inject({
      method: "POST",
      url: "/v1/resources",
      headers: {
        authorization: "Bearer dev-member-token"
      },
      payload: {
        resourceType: "purchase",
        externalId
      }
    });

    expect(resourceResponse.statusCode).toBe(201);

    const resource = resourceResponse.json<{
      id: string;
    }>();

    const response = await app.inject({
      method: "POST",
      url: `/v1/resources/${resource.id}/events`,
      headers: {
        authorization: "Bearer dev-member-token"
      },
      payload: {
        eventType: "create",
        state: {
          customer: "Audit Test",
          status: "open"
        }
      }
    });

    expect(response.statusCode).toBe(201);

    const event = response.json<{
      eventId: string;
    }>();

    const audit = await pool.query<{
      action: string;
      outcome: string;
      tenant_id: string;
      user_id: string;
      resource_id: string;
      metadata: Record<string, unknown>;
    }>(
      `
      SELECT
        action,
        outcome,
        tenant_id,
        user_id,
        resource_id,
        metadata
      FROM audit_events
      WHERE action = 'EVIDENCE_CREATED'
        AND resource_id = $1
      ORDER BY occurred_at DESC
      LIMIT 1
      `,
      [resource.id]
    );

    expect(audit.rows[0]).toMatchObject({
      action: "EVIDENCE_CREATED",
      outcome: "success",
      tenant_id: "2a46cf83-111b-4469-9bca-5e16196541f9",
      resource_id: resource.id
    });

    expect(audit.rows[0].user_id).toBeTruthy();
    expect(audit.rows[0].metadata).toMatchObject({
      eventId: event.eventId,
      eventType: "create",
      version: 1
    });
  });

  it("audits successful batch creation", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/v1/batches",
      headers: {
        authorization: "Bearer dev-admin-token"
      },
      payload: {
        batchSize: 10
      }
    });

    expect(response.statusCode).toBe(201);

    const batch = response.json<{
      id: string;
      merkleRoot: string;
      eventCount: number;
    }>();

    const audit = await pool.query<{
      action: string;
      outcome: string;
      tenant_id: string;
      user_id: string;
      resource_id: string;
      metadata: Record<string, unknown>;
    }>(
      `
      SELECT
        action,
        outcome,
        tenant_id,
        user_id,
        resource_id,
        metadata
      FROM audit_events
      WHERE action = 'BATCH_CREATED'
        AND resource_id = $1
      ORDER BY occurred_at DESC
      LIMIT 1
      `,
      [batch.id]
    );

    expect(audit.rows[0]).toMatchObject({
      action: "BATCH_CREATED",
      outcome: "success",
      tenant_id: "2a46cf83-111b-4469-9bca-5e16196541f9",
      resource_id: batch.id
    });

    expect(audit.rows[0].user_id).toBeTruthy();
    expect(audit.rows[0].metadata).toMatchObject({
      merkleRoot: batch.merkleRoot,
      protocolVersion: "v1",
      eventCount: batch.eventCount
    });
  });

  it("verifies an anchored event through the API", async () => {
    const externalId = `verify-api-${Date.now()}`;

    const resourceResponse = await app.inject({
      method: "POST",
      url: "/v1/resources",
      headers: {
        authorization: "Bearer dev-member-token"
      },
      payload: {
        resourceType: "purchase",
        externalId
      }
    });

    expect(resourceResponse.statusCode).toBe(201);

    const resource = resourceResponse.json<{
      id: string;
    }>();

    const evidenceResponse = await app.inject({
      method: "POST",
      url: `/v1/resources/${resource.id}/events`,
      headers: {
        authorization: "Bearer dev-member-token"
      },
      payload: {
        eventType: "create",
        state: {
          customer: "API Verification Test",
          amount: 100000,
          currency: "INR",
          status: "open"
        }
      }
    });

    expect(evidenceResponse.statusCode).toBe(201);

    const event = evidenceResponse.json<{
      eventId: string;
    }>();

    const batchResponse = await app.inject({
      method: "POST",
      url: "/v1/batches",
      headers: {
        authorization: "Bearer dev-admin-token"
      },
      payload: {
        batchSize: 10
      }
    });

    expect(batchResponse.statusCode).toBe(201);

    const batch = batchResponse.json<{
      id: string;
    }>();

    const anchorResponse = await app.inject({
      method: "POST",
      url: `/v1/batches/${batch.id}/anchor`,
      headers: {
        authorization: "Bearer dev-admin-token"
      }
    });

    expect(anchorResponse.statusCode).toBe(200);

    const verifyResponse = await app.inject({
      method: "GET",
      url: `/v1/verify/${event.eventId}`,
      headers: {
        authorization: "Bearer dev-member-token"
      }
    });

    expect(verifyResponse.statusCode).toBe(200);

    const verification = verifyResponse.json<{
      valid: boolean;
      reason: string;
      eventId: string;
      batchId: string;
      merkleRoot: string;
    }>();

    expect(verification.valid).toBe(true);
    expect(verification.reason).toBe("VALID");
    expect(verification.eventId).toBe(event.eventId);
    expect(verification.batchId).toBe(batch.id);
    expect(verification.merkleRoot).toBeTruthy();
  });

  it("detects state tampering through the API", async () => {
    const externalId = `verify-tamper-${Date.now()}`;

    const resourceResponse = await app.inject({
      method: "POST",
      url: "/v1/resources",
      headers: {
        authorization: "Bearer dev-member-token"
      },
      payload: {
        resourceType: "purchase",
        externalId
      }
    });

    expect(resourceResponse.statusCode).toBe(201);

    const resource = resourceResponse.json<{
      id: string;
    }>();

    const evidenceResponse = await app.inject({
      method: "POST",
      url: `/v1/resources/${resource.id}/events`,
      headers: {
        authorization: "Bearer dev-member-token"
      },
      payload: {
        eventType: "create",
        state: {
          customer: "API Tamper Test",
          amount: 50000,
          currency: "INR",
          status: "open"
        }
      }
    });

    expect(evidenceResponse.statusCode).toBe(201);

    const event = evidenceResponse.json<{
      eventId: string;
    }>();

    const batchResponse = await app.inject({
      method: "POST",
      url: "/v1/batches",
      headers: {
        authorization: "Bearer dev-admin-token"
      },
      payload: {
        batchSize: 10
      }
    });

    expect(batchResponse.statusCode).toBe(201);

    const batch = batchResponse.json<{
      id: string;
    }>();

    const anchorResponse = await app.inject({
      method: "POST",
      url: `/v1/batches/${batch.id}/anchor`,
      headers: {
        authorization: "Bearer dev-admin-token"
      }
    });

    expect(anchorResponse.statusCode).toBe(200);

    const version = await pool.query<{
      id: string;
    }>(
      `
      SELECT rv.id
      FROM resource_versions rv
      JOIN resources r
        ON r.id = rv.resource_id
      WHERE r.id = $1
      ORDER BY rv.version DESC
      LIMIT 1
      `,
      [resource.id]
    );

    expect(version.rows[0]).toBeTruthy();

    await pool.query(
      `
      UPDATE resource_versions
      SET state = jsonb_set(
        state,
        '{amount}',
        '999999'
      )
      WHERE id = $1
      `,
      [version.rows[0].id]
    );

    const verifyResponse = await app.inject({
      method: "GET",
      url: `/v1/verify/${event.eventId}`,
      headers: {
        authorization: "Bearer dev-member-token"
      }
    });

    expect(verifyResponse.statusCode).toBe(200);

    const verification = verifyResponse.json<{
      valid: boolean;
      reason: string;
      eventId: string;
    }>();

    expect(verification.valid).toBe(false);
    expect(verification.reason).toBe("STATE_TAMPERED");
    expect(verification.eventId).toBe(event.eventId);
  });

  it("detects an anchor mismatch through the API", async () => {
    const externalId = `verify-anchor-${Date.now()}`;

    const resourceResponse = await app.inject({
      method: "POST",
      url: "/v1/resources",
      headers: {
        authorization: "Bearer dev-member-token"
      },
      payload: {
        resourceType: "purchase",
        externalId
      }
    });

    expect(resourceResponse.statusCode).toBe(201);

    const resource = resourceResponse.json<{ id: string }>();

    const evidenceResponse = await app.inject({
      method: "POST",
      url: `/v1/resources/${resource.id}/events`,
      headers: {
        authorization: "Bearer dev-member-token"
      },
      payload: {
        eventType: "create",
        state: {
          customer: "API Anchor Test",
          amount: 75000,
          currency: "INR",
          status: "open"
        }
      }
    });

    expect(evidenceResponse.statusCode).toBe(201);

    const event = evidenceResponse.json<{ eventId: string }>();

    const batchResponse = await app.inject({
      method: "POST",
      url: "/v1/batches",
      headers: {
        authorization: "Bearer dev-admin-token"
      },
      payload: {
        batchSize: 10
      }
    });

    expect(batchResponse.statusCode).toBe(201);

    const batch = batchResponse.json<{ id: string }>();

    const anchorResponse = await app.inject({
      method: "POST",
      url: `/v1/batches/${batch.id}/anchor`,
      headers: {
        authorization: "Bearer dev-admin-token"
      }
    });

    expect(anchorResponse.statusCode).toBe(200);

    await pool.query(
      `
      UPDATE anchor_batches
      SET merkle_root = encode(
        digest('tampered-api-anchor', 'sha256'),
        'hex'
      )
      WHERE id = $1
      `,
      [batch.id]
    );

    const verifyResponse = await app.inject({
      method: "GET",
      url: `/v1/verify/${event.eventId}`,
      headers: {
        authorization: "Bearer dev-member-token"
      }
    });

    expect(verifyResponse.statusCode).toBe(200);

    const verification = verifyResponse.json<{
      valid: boolean;
      reason: string;
      eventId: string;
    }>();

    expect(verification.valid).toBe(false);
    expect(verification.reason).toBe("ANCHOR_MISMATCH");
    expect(verification.eventId).toBe(event.eventId);
  });

  it("denies cross-tenant verification access", async () => {
    const externalId = `verify-cross-tenant-${Date.now()}`;

    const resourceResponse = await app.inject({
      method: "POST",
      url: "/v1/resources",
      headers: {
        authorization: "Bearer dev-member-token"
      },
      payload: {
        resourceType: "purchase",
        externalId
      }
    });

    expect(resourceResponse.statusCode).toBe(201);

    const resource = resourceResponse.json<{
      id: string;
    }>();

    const evidenceResponse = await app.inject({
      method: "POST",
      url: `/v1/resources/${resource.id}/events`,
      headers: {
        authorization: "Bearer dev-member-token"
      },
      payload: {
        eventType: "create",
        state: {
          customer: "Tenant A Private Event",
          amount: 125000,
          currency: "INR",
          status: "open"
        }
      }
    });

    expect(evidenceResponse.statusCode).toBe(201);

    const event = evidenceResponse.json<{
      eventId: string;
    }>();

    const batchResponse = await app.inject({
      method: "POST",
      url: "/v1/batches",
      headers: {
        authorization: "Bearer dev-admin-token"
      },
      payload: {
        batchSize: 10
      }
    });

    expect(batchResponse.statusCode).toBe(201);

    const batch = batchResponse.json<{
      id: string;
    }>();

    const anchorResponse = await app.inject({
      method: "POST",
      url: `/v1/batches/${batch.id}/anchor`,
      headers: {
        authorization: "Bearer dev-admin-token"
      }
    });

    expect(anchorResponse.statusCode).toBe(200);

    const ownerVerification = await app.inject({
      method: "GET",
      url: `/v1/verify/${event.eventId}`,
      headers: {
        authorization: "Bearer dev-member-token"
      }
    });

    expect(ownerVerification.statusCode).toBe(200);

    const ownerResult = ownerVerification.json<{
      valid: boolean;
      reason: string;
    }>();

    expect(ownerResult.valid).toBe(true);
    expect(ownerResult.reason).toBe("VALID");

    const crossTenantVerification = await app.inject({
      method: "GET",
      url: `/v1/verify/${event.eventId}`,
      headers: {
        authorization: "Bearer tenant-b-token"
      }
    });

    expect(crossTenantVerification.statusCode).toBe(404);
    expect(crossTenantVerification.json()).toEqual({
      error: "EVENT_NOT_FOUND"
    });
  });

  it("audits successful batch anchoring", async () => {
    const externalId = `audit-anchor-${Date.now()}`;

    const resourceResponse = await app.inject({
      method: "POST",
      url: "/v1/resources",
      headers: {
        authorization: "Bearer dev-member-token"
      },
      payload: {
        resourceType: "purchase",
        externalId
      }
    });

    expect(resourceResponse.statusCode).toBe(201);

    const resource = resourceResponse.json<{
      id: string;
    }>();

    const evidenceResponse = await app.inject({
      method: "POST",
      url: `/v1/resources/${resource.id}/events`,
      headers: {
        authorization: "Bearer dev-member-token"
      },
      payload: {
        eventType: "create",
        state: {
          customer: "Anchor Audit Test",
          status: "open"
        }
      }
    });

    expect(evidenceResponse.statusCode).toBe(201);

    const batchResponse = await app.inject({
      method: "POST",
      url: "/v1/batches",
      headers: {
        authorization: "Bearer dev-admin-token"
      },
      payload: {
        batchSize: 10
      }
    });

    expect(batchResponse.statusCode).toBe(201);

    const batch = batchResponse.json<{
      id: string;
      merkleRoot: string;
    }>();

    const anchorResponse = await app.inject({
      method: "POST",
      url: `/v1/batches/${batch.id}/anchor`,
      headers: {
        authorization: "Bearer dev-admin-token"
      }
    });

    expect(anchorResponse.statusCode).toBe(200);

    const anchored = anchorResponse.json<{
      status: string;
      blockchainReference: string | null;
    }>();

    expect(anchored.status).toBe("anchored");
    expect(anchored.blockchainReference).toBeTruthy();

    const audit = await pool.query<{
      action: string;
      outcome: string;
      tenant_id: string;
      user_id: string;
      resource_id: string;
      request_id: string | null;
      metadata: Record<string, unknown>;
    }>(
      `
      SELECT
        action,
        outcome,
        tenant_id,
        user_id,
        resource_id,
        request_id,
        metadata
      FROM audit_events
      WHERE action = 'BATCH_ANCHORED'
        AND resource_id = $1
      ORDER BY occurred_at DESC
      LIMIT 1
      `,
      [batch.id]
    );

    const auth = await resolveAuthContext("dev-admin-user");

    expect(auth).not.toBeNull();

    expect(audit.rows[0]).toMatchObject({
      action: "BATCH_ANCHORED",
      outcome: "success",
      tenant_id: auth!.tenantId,
      user_id: auth!.userId,
      resource_id: batch.id
    });

    expect(audit.rows[0].request_id).toBeTruthy();
    expect(audit.rows[0].metadata).toMatchObject({
      merkleRoot: batch.merkleRoot,
      protocolVersion: "v1"
    });

    expect(audit.rows[0].metadata.transactionId).toBeTruthy();
  });

  it("audits authentication failures", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/v1/resources",
      payload: {
        resourceType: "purchase",
      }
    });

    expect(response.statusCode).toBe(401);

    const audit = await pool.query<{
      action: string;
      outcome: string;
      tenant_id: string | null;
      user_id: string | null;
      request_id: string | null;
      metadata: Record<string, unknown>;
    }>(
      `
      SELECT
        action,
        outcome,
        tenant_id,
        user_id,
        request_id,
        metadata
      FROM audit_events
      WHERE action = 'AUTHENTICATION_FAILED'
      ORDER BY occurred_at DESC
      LIMIT 1
      `
    );

    expect(audit.rows[0]).toMatchObject({
      action: "AUTHENTICATION_FAILED",
      outcome: "failure",
      tenant_id: null,
      user_id: null
    });

    expect(audit.rows[0].request_id).toBeTruthy();
    expect(audit.rows[0].metadata).toMatchObject({
      method: "POST",
      url: "/v1/resources"
    });
  });

  it("audits authorization denials", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/v1/batches",
      headers: {
        authorization: "Bearer dev-member-token"
      },
      payload: {
        batchSize: 10
      }
    });

    expect(response.statusCode).toBe(403);

    const auth = await resolveAuthContext("dev-member-user");

    expect(auth).not.toBeNull();

    const audit = await pool.query<{
      action: string;
      outcome: string;
      tenant_id: string | null;
      user_id: string | null;
      request_id: string | null;
      metadata: Record<string, unknown>;
    }>(
      `
      SELECT
        action,
        outcome,
        tenant_id,
        user_id,
        request_id,
        metadata
      FROM audit_events
      WHERE action = 'AUTHORIZATION_DENIED'
        AND user_id = $1
      ORDER BY occurred_at DESC
      LIMIT 1
      `,
      [auth!.userId]
    );

    expect(audit.rows[0]).toMatchObject({
      action: "AUTHORIZATION_DENIED",
      outcome: "denied",
      tenant_id: auth!.tenantId,
      user_id: auth!.userId
    });

    expect(audit.rows[0].request_id).toBeTruthy();
    expect(audit.rows[0].metadata).toMatchObject({
      method: "POST",
      url: "/v1/batches"
    });
  });

  it("audits rate-limited requests", async () => {
    const rateLimitedApp = buildServer({
      rateLimitMax: 1,
      rateLimitWindow: "1 minute"
    });

    await rateLimitedApp.ready();

    try {
      const request = {
        method: "GET" as const,
        url: "/v1/batches/00000000-0000-4000-8000-000000000001",
        headers: {
          authorization: "Bearer dev-member-token"
        }
      };

      const first = await rateLimitedApp.inject(request);
      const second = await rateLimitedApp.inject(request);

      expect(first.statusCode).toBe(404);
      expect(second.statusCode).toBe(429);

      const auth = await resolveAuthContext("dev-member-user");

      expect(auth).not.toBeNull();

      const audit = await pool.query<{
        action: string;
        outcome: string;
        tenant_id: string | null;
        user_id: string | null;
        request_id: string | null;
        metadata: Record<string, unknown>;
      }>(
        `
        SELECT
          action,
          outcome,
          tenant_id,
          user_id,
          request_id,
          metadata
        FROM audit_events
        WHERE action = 'RATE_LIMITED'
          AND user_id = $1
        ORDER BY occurred_at DESC
        LIMIT 1
        `,
        [auth!.userId]
      );

      expect(audit.rows[0]).toMatchObject({
        action: "RATE_LIMITED",
        outcome: "denied",
        tenant_id: auth!.tenantId,
        user_id: auth!.userId
      });

      expect(audit.rows[0].request_id).toBeTruthy();
      expect(audit.rows[0].metadata).toMatchObject({
        method: "GET",
        url: "/v1/batches/00000000-0000-4000-8000-000000000001"
      });
    } finally {
      await rateLimitedApp.close();
    }
  });

  it("allows admins to query tenant-scoped audit events", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/v1/audit?limit=10&offset=0",
      headers: {
        authorization: "Bearer dev-admin-token"
      }
    });

    expect(response.statusCode).toBe(200);

    const body = response.json<{
      items: Array<{
        tenantId: string;
        action: string;
        outcome: string;
      }>;
      limit: number;
      offset: number;
      count: number;
    }>();

    expect(body.limit).toBe(10);
    expect(body.offset).toBe(0);
    expect(body.count).toBeGreaterThanOrEqual(1);
    expect(body.items.length).toBeGreaterThan(0);

    for (const item of body.items) {
      expect(item.tenantId).toBe("2a46cf83-111b-4469-9bca-5e16196541f9");
    }
  });

  it("denies members from querying audit events", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/v1/audit",
      headers: {
        authorization: "Bearer dev-member-token"
      }
    });

    expect(response.statusCode).toBe(403);
  });

  it("filters audit events by action and outcome", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/v1/audit?action=RESOURCE_CREATED&outcome=success",
      headers: {
        authorization: "Bearer dev-admin-token"
      }
    });

    expect(response.statusCode).toBe(200);

    const body = response.json<{
      items: Array<{
        action: string;
        outcome: string;
        tenantId: string;
      }>;
    }>();

    expect(body.items.length).toBeGreaterThan(0);

    for (const item of body.items) {
      expect(item.action).toBe("RESOURCE_CREATED");
      expect(item.outcome).toBe("success");
      expect(item.tenantId).toBe(
        "2a46cf83-111b-4469-9bca-5e16196541f9"
      );
    }
  });

  it("rejects invalid audit query parameters", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/v1/audit?limit=101",
      headers: {
        authorization: "Bearer dev-admin-token"
      }
    });

    expect(response.statusCode).toBe(400);
  });

  it("paginates audit results", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/v1/audit?limit=1&offset=0",
      headers: {
        authorization: "Bearer dev-admin-token"
      }
    });

    expect(response.statusCode).toBe(200);

    const body = response.json<{
      items: unknown[];
      limit: number;
      offset: number;
      count: number;
    }>();

    expect(body.limit).toBe(1);
    expect(body.offset).toBe(0);
    expect(body.items.length).toBeLessThanOrEqual(1);
  });

  it("does not leak audit events across tenants", async () => {
    const client = await pool.connect();

    let tenantBId: string | undefined;
    let userBId: string | undefined;

    try {
      await client.query("BEGIN");

      const tenant = await client.query<{ id: string }>(
        `
        INSERT INTO tenants (name, slug)
        VALUES ($1, $2)
        RETURNING id
        `,
        [
          "Audit Isolation Test Tenant",
          `audit-isolation-${Date.now()}`
        ]
      );

      tenantBId = tenant.rows[0].id;

      const user = await client.query<{ id: string }>(
        `
        INSERT INTO users (external_subject, email)
        VALUES ($1, $2)
        RETURNING id
        `,
        [
          `audit-isolation-user-${Date.now()}`,
          `audit-isolation-${Date.now()}@vsl.local`
        ]
      );

      userBId = user.rows[0].id;

      await client.query(
        `
        INSERT INTO tenant_memberships (
          tenant_id,
          user_id,
          role
        )
        VALUES ($1, $2, 'admin')
        `,
        [tenantBId, userBId]
      );

      await client.query(
        `
        INSERT INTO audit_events (
          tenant_id,
          user_id,
          action,
          outcome,
          metadata
        )
        VALUES ($1, $2, 'TENANT_B_SECRET', 'success', $3::jsonb)
        `,
        [
          tenantBId,
          userBId,
          JSON.stringify({
            secret: "must-not-leak"
          })
        ]
      );

      await client.query("COMMIT");

      const response = await app.inject({
        method: "GET",
        url: "/v1/audit?action=TENANT_B_SECRET",
        headers: {
          authorization: "Bearer dev-admin-token"
        }
      });

      expect(response.statusCode).toBe(200);

      const body = response.json<{
        items: Array<{
          tenantId: string;
          action: string;
        }>;
      }>();

      expect(body.items).toHaveLength(0);
    } finally {
      try {
        await client.query("BEGIN");

        if (tenantBId) {
          await client.query(
            `
            DELETE FROM audit_events
            WHERE tenant_id = $1
            `,
            [tenantBId]
          );

          await client.query(
            `
            DELETE FROM tenant_memberships
            WHERE tenant_id = $1
            `,
            [tenantBId]
          );

          if (userBId) {
            await client.query(
              `
              DELETE FROM users
              WHERE id = $1
              `,
              [userBId]
            );
          }

          await client.query(
            `
            DELETE FROM tenants
            WHERE id = $1
            `,
            [tenantBId]
          );
        }

        await client.query("COMMIT");
      } catch {
        await client.query("ROLLBACK");
      }

      client.release();
    }
  });

});
