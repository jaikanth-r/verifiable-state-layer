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
        externalId: `auth-failure-${Date.now()}`
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
