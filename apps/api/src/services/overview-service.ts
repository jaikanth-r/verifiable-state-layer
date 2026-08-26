import { pool } from "../config/database.js";
import type { AuthContext } from "./auth-context.js";

export interface OverviewResource {
  id: string;
  resourceType: string;
  externalId: string;
  createdAt: string;
}

export interface OverviewAudit {
  id: string;
  occurredAt: string;
  userId: string | null;
  action: string;
  outcome: "success" | "failure" | "denied";
  resourceId: string | null;
}

export interface OverviewSummary {
  resources: number;
  evidenceEvents: number;
  anchoredBatches: number;
  pendingBatches: number;
  failedBatches: number;
  recentResources: OverviewResource[];
  recentAudit: OverviewAudit[];
}

export async function getOverview(
  auth: AuthContext
): Promise<OverviewSummary> {
  const [
    resourcesResult,
    evidenceResult,
    batchesResult,
    recentResourcesResult,
    recentAuditResult
  ] = await Promise.all([
    pool.query<{ count: number }>(
      `
      SELECT COUNT(*)::int AS count
      FROM resources
      WHERE tenant_id = $1
      `,
      [auth.tenantId]
    ),

    pool.query<{ count: number }>(
      `
      SELECT COUNT(*)::int AS count
      FROM evidence_events ee
      INNER JOIN resources r
        ON r.id = ee.resource_id
      WHERE r.tenant_id = $1
      `,
      [auth.tenantId]
    ),

    pool.query<{
      anchored: number;
      pending: number;
      failed: number;
    }>(
      `
      SELECT
        COUNT(*) FILTER (WHERE status = 'anchored')::int AS anchored,
        COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
        COUNT(*) FILTER (WHERE status = 'failed')::int AS failed
      FROM anchor_batches
      WHERE tenant_id = $1
      `,
      [auth.tenantId]
    ),

    pool.query<{
      id: string;
      resource_type: string;
      external_id: string;
      created_at: Date;
    }>(
      `
      SELECT
        id,
        resource_type,
        external_id,
        created_at
      FROM resources
      WHERE tenant_id = $1
      ORDER BY created_at DESC, id DESC
      LIMIT 5
      `,
      [auth.tenantId]
    ),

    pool.query<{
      id: string;
      occurred_at: Date;
      user_id: string | null;
      action: string;
      outcome: "success" | "failure" | "denied";
      resource_id: string | null;
    }>(
      `
      SELECT
        id,
        occurred_at,
        user_id,
        action,
        outcome,
        resource_id
      FROM audit_events
      WHERE tenant_id = $1
      ORDER BY occurred_at DESC, id DESC
      LIMIT 8
      `,
      [auth.tenantId]
    )
  ]);

  return {
    resources: resourcesResult.rows[0]?.count ?? 0,
    evidenceEvents: evidenceResult.rows[0]?.count ?? 0,
    anchoredBatches: batchesResult.rows[0]?.anchored ?? 0,
    pendingBatches: batchesResult.rows[0]?.pending ?? 0,
    failedBatches: batchesResult.rows[0]?.failed ?? 0,

    recentResources: recentResourcesResult.rows.map((row) => ({
      id: row.id,
      resourceType: row.resource_type,
      externalId: row.external_id,
      createdAt: row.created_at.toISOString()
    })),

    recentAudit: recentAuditResult.rows.map((row) => ({
      id: row.id,
      occurredAt: row.occurred_at.toISOString(),
      userId: row.user_id,
      action: row.action,
      outcome: row.outcome,
      resourceId: row.resource_id
    }))
  };
}
