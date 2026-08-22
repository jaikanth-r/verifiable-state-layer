import { pool } from "../config/database.js";
import type { AuthContext } from "./auth-context.js";

export interface AuditQuery {
  limit?: number;
  offset?: number;
  action?: string;
  outcome?: "success" | "failure" | "denied";
  userId?: string;
  resourceId?: string;
  requestId?: string;
}

export interface AuditRecord {
  id: string;
  occurredAt: string;
  tenantId: string;
  userId: string | null;
  action: string;
  outcome: "success" | "failure" | "denied";
  resourceId: string | null;
  requestId: string | null;
  metadata: Record<string, unknown>;
}

export interface AuditPage {
  items: AuditRecord[];
  limit: number;
  offset: number;
  count: number;
}

export async function queryAuditEvents(
  auth: AuthContext,
  query: AuditQuery
): Promise<AuditPage> {
  const limit = Math.min(Math.max(query.limit ?? 50, 1), 100);
  const offset = Math.max(query.offset ?? 0, 0);

  const conditions = ["tenant_id = $1"];
  const params: unknown[] = [auth.tenantId];

  const addParam = (value: unknown): string => {
    params.push(value);
    return `$${params.length}`;
  };

  if (query.action) {
    conditions.push(`action = ${addParam(query.action)}`);
  }

  if (query.outcome) {
    conditions.push(`outcome = ${addParam(query.outcome)}`);
  }

  if (query.userId) {
    conditions.push(`user_id = ${addParam(query.userId)}`);
  }

  if (query.resourceId) {
    conditions.push(`resource_id = ${addParam(query.resourceId)}`);
  }

  if (query.requestId) {
    conditions.push(`request_id = ${addParam(query.requestId)}`);
  }

  const where = conditions.join("\n      AND ");

  const countResult = await pool.query<{ count: string }>(
    `
    SELECT COUNT(*)::bigint AS count
    FROM audit_events
    WHERE ${where}
    `,
    params
  );

  const resultParams = [...params, limit, offset];

  const result = await pool.query<{
    id: string;
    occurred_at: Date;
    tenant_id: string;
    user_id: string | null;
    action: string;
    outcome: "success" | "failure" | "denied";
    resource_id: string | null;
    request_id: string | null;
    metadata: Record<string, unknown>;
  }>(
    `
    SELECT
      id,
      occurred_at,
      tenant_id,
      user_id,
      action,
      outcome,
      resource_id,
      request_id,
      metadata
    FROM audit_events
    WHERE ${where}
    ORDER BY occurred_at DESC, id DESC
    LIMIT $${resultParams.length - 1}
    OFFSET $${resultParams.length}
    `,
    resultParams
  );

  return {
    items: result.rows.map((row) => ({
      id: row.id,
      occurredAt: row.occurred_at.toISOString(),
      tenantId: row.tenant_id,
      userId: row.user_id,
      action: row.action,
      outcome: row.outcome,
      resourceId: row.resource_id,
      requestId: row.request_id,
      metadata: row.metadata
    })),
    limit,
    offset,
    count: Number(countResult.rows[0]?.count ?? 0)
  };
}
