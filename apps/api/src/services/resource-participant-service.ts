import { pool } from "../config/database.js";
import type { AuthContext } from "./auth-context.js";

export interface ResourceParticipant {
  resourceId: string;
  tenantId: string;
  role: "owner" | "counterparty" | "carrier" | "inspector" | "other";
  createdAt: string;
}

const PARTICIPANT_ROLES = [
  "counterparty",
  "carrier",
  "inspector",
  "other"
] as const;

export type ParticipantRole =
  (typeof PARTICIPANT_ROLES)[number];

export function isParticipantRole(
  value: string
): value is ParticipantRole {
  return PARTICIPANT_ROLES.includes(
    value as ParticipantRole
  );
}

export async function addParticipant(
  auth: AuthContext,
  resourceId: string,
  tenantId: string,
  role: ParticipantRole,
  requestId?: string
): Promise<ResourceParticipant> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const resource = await client.query<{
      tenant_id: string;
    }>(
      `
      SELECT tenant_id
      FROM resources
      WHERE id = $1
      FOR UPDATE
      `,
      [resourceId]
    );

    const resourceRow = resource.rows[0];

    if (!resourceRow) {
      throw new Error("Resource not found");
    }

    if (resourceRow.tenant_id !== auth.tenantId) {
      throw new Error("FORBIDDEN");
    }

    if (tenantId === resourceRow.tenant_id) {
      throw new Error(
        "Resource owner is already a participant"
      );
    }

    const tenant = await client.query(
      `
      SELECT 1
      FROM tenants
      WHERE id = $1
      `,
      [tenantId]
    );

    if (tenant.rowCount !== 1) {
      throw new Error("Tenant not found");
    }

    const result = await client.query<{
      resource_id: string;
      tenant_id: string;
      role: ParticipantRole;
      created_at: Date;
    }>(
      `
      INSERT INTO resource_participants (
        resource_id,
        tenant_id,
        role
      )
      VALUES ($1, $2, $3)
      RETURNING
        resource_id,
        tenant_id,
        role,
        created_at
      `,
      [resourceId, tenantId, role]
    );

    const row = result.rows[0];

    await client.query(
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
      `,
      [
        auth.tenantId,
        auth.userId,
        "RESOURCE_PARTICIPANT_ADDED",
        "success",
        resourceId,
        requestId ?? null,
        JSON.stringify({
          participantTenantId: tenantId,
          role
        })
      ]
    );

    await client.query("COMMIT");

    return {
      resourceId: row.resource_id,
      tenantId: row.tenant_id,
      role: row.role,
      createdAt: row.created_at.toISOString()
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function listParticipants(
  auth: AuthContext,
  resourceId: string
): Promise<ResourceParticipant[]> {
  const access = await pool.query(
    `
    SELECT 1
    FROM resources r
    WHERE r.id = $1
      AND (
        r.tenant_id = $2
        OR EXISTS (
          SELECT 1
          FROM resource_participants rp
          WHERE rp.resource_id = r.id
            AND rp.tenant_id = $2
        )
      )
    `,
    [resourceId, auth.tenantId]
  );

  if (access.rowCount !== 1) {
    throw new Error("Resource not found");
  }

  const result = await pool.query<{
    resource_id: string;
    tenant_id: string;
    role: ParticipantRole;
    created_at: Date;
  }>(
    `
    SELECT
      resource_id,
      tenant_id,
      role,
      created_at
    FROM resource_participants
    WHERE resource_id = $1
    ORDER BY created_at ASC
    `,
    [resourceId]
  );

  return result.rows.map((row) => ({
    resourceId: row.resource_id,
    tenantId: row.tenant_id,
    role: row.role,
    createdAt: row.created_at.toISOString()
  }));
}
