import { pool } from "../config/database.js";

import type { AuthContext } from "./auth-context.js";

export type AuditOutcome =
  | "success"
  | "failure"
  | "denied";

export interface RecordAuditEventInput {
  tenantId?: string | null;
  userId?: string | null;
  action: string;
  outcome: AuditOutcome;
  resourceId?: string | null;
  requestId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface AuditEventRecord {
  id: string;
  occurredAt: string;
  tenantId: string | null;
  userId: string | null;
  action: string;
  outcome: AuditOutcome;
  resourceId: string | null;
  requestId: string | null;
  metadata: Record<string, unknown>;
}

export async function recordAuditEvent(
  input: RecordAuditEventInput
): Promise<AuditEventRecord> {
  const result = await pool.query<{
    id: string;
    occurred_at: Date;
    tenant_id: string | null;
    user_id: string | null;
    action: string;
    outcome: AuditOutcome;
    resource_id: string | null;
    request_id: string | null;
    metadata: Record<string, unknown>;
  }>(
    `
    INSERT INTO audit_events (
      tenant_id,
      user_id,
      action,
      outcome,
      resource_id,
      request_id,
      metadata
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
    RETURNING
      id,
      occurred_at,
      tenant_id,
      user_id,
      action,
      outcome,
      resource_id,
      request_id,
      metadata
    `,
    [
      input.tenantId ?? null,
      input.userId ?? null,
      input.action,
      input.outcome,
      input.resourceId ?? null,
      input.requestId ?? null,
      JSON.stringify(input.metadata ?? {})
    ]
  );

  const row = result.rows[0];

  return {
    id: row.id,
    occurredAt: row.occurred_at.toISOString(),
    tenantId: row.tenant_id,
    userId: row.user_id,
    action: row.action,
    outcome: row.outcome,
    resourceId: row.resource_id,
    requestId: row.request_id,
    metadata: row.metadata
  };
}

export function auditContext(
  auth: AuthContext
): Pick<RecordAuditEventInput, "tenantId" | "userId"> {
  return {
    tenantId: auth.tenantId,
    userId: auth.userId
  };
}
