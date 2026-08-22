import { afterEach, describe, expect, it } from "vitest";

import { pool } from "../config/database.js";
import {
  auditContext,
  recordAuditEvent
} from "./audit-service.js";

const TEST_TENANT_ID =
  "2a46cf83-111b-4469-9bca-5e16196541f9";

const TEST_USER_ID =
  "66d5c5fc-c3c4-4e8b-94d3-d4c8c13f666f";

afterEach(async () => {
  await pool.query(
    `
    DELETE FROM audit_events
    WHERE request_id = 'audit-service-test'
    `
  );
});

describe("AuditService", () => {
  it("persists a tenant-scoped audit event", async () => {
    const event = await recordAuditEvent({
      tenantId: TEST_TENANT_ID,
      userId: TEST_USER_ID,
      action: "RESOURCE_CREATED",
      outcome: "success",
      resourceId: "00000000-0000-4000-8000-000000000001",
      requestId: "audit-service-test",
      metadata: {
        resourceType: "purchase"
      }
    });

    expect(event.id).toBeTruthy();
    expect(event.tenantId).toBe(TEST_TENANT_ID);
    expect(event.userId).toBe(TEST_USER_ID);
    expect(event.action).toBe("RESOURCE_CREATED");
    expect(event.outcome).toBe("success");
    expect(event.metadata).toEqual({
      resourceType: "purchase"
    });

    const stored = await pool.query<{
      tenant_id: string;
      user_id: string;
      action: string;
      outcome: string;
      request_id: string;
    }>(
      `
      SELECT
        tenant_id,
        user_id,
        action,
        outcome,
        request_id
      FROM audit_events
      WHERE id = $1
      `,
      [event.id]
    );

    expect(stored.rows[0]).toEqual({
      tenant_id: TEST_TENANT_ID,
      user_id: TEST_USER_ID,
      action: "RESOURCE_CREATED",
      outcome: "success",
      request_id: "audit-service-test"
    });
  });

  it("supports audit events without a trusted identity", async () => {
    const event = await recordAuditEvent({
      action: "AUTHENTICATION_FAILED",
      outcome: "failure",
      requestId: "audit-service-test",
      metadata: {
        reason: "invalid_token"
      }
    });

    expect(event.tenantId).toBeNull();
    expect(event.userId).toBeNull();
    expect(event.action).toBe("AUTHENTICATION_FAILED");
    expect(event.outcome).toBe("failure");
  });

  it("extracts tenant and user identity from auth context", () => {
    expect(
      auditContext({
        tenantId: TEST_TENANT_ID,
        userId: TEST_USER_ID,
        role: "owner"
      })
    ).toEqual({
      tenantId: TEST_TENANT_ID,
      userId: TEST_USER_ID
    });
  });
});
