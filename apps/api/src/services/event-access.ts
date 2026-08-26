import { pool } from "../config/database.js";
import type { AuthContext } from "./auth-context.js";

export interface EventAccess {
  eventId: string;
  resourceId: string;
  ownerTenantId: string;
  participantRole:
    | "owner"
    | "counterparty"
    | "carrier"
    | "inspector"
    | "other";
}

export async function requireEventAccess(
  auth: AuthContext,
  eventId: string
): Promise<EventAccess> {
  const result = await pool.query<{
    event_id: string;
    resource_id: string;
    owner_tenant_id: string;
    participant_role:
      | "owner"
      | "counterparty"
      | "carrier"
      | "inspector"
      | "other";
  }>(
    `
    SELECT
      ee.event_id,
      ee.resource_id,
      r.tenant_id AS owner_tenant_id,
      CASE
        WHEN r.tenant_id = $2 THEN 'owner'
        ELSE rp.role
      END AS participant_role
    FROM evidence_events ee
    JOIN resources r
      ON r.id = ee.resource_id
    LEFT JOIN resource_participants rp
      ON rp.resource_id = r.id
     AND rp.tenant_id = $2
    WHERE ee.event_id = $1
      AND (
        r.tenant_id = $2
        OR rp.tenant_id = $2
      )
    LIMIT 1
    `,
    [eventId, auth.tenantId]
  );

  const row = result.rows[0];

  if (!row) {
    throw new Error("Event not found");
  }

  return {
    eventId: row.event_id,
    resourceId: row.resource_id,
    ownerTenantId: row.owner_tenant_id,
    participantRole: row.participant_role
  };
}

export async function requireResourceWriteAccess(
  auth: AuthContext,
  resourceId: string
): Promise<{
  ownerTenantId: string;
  participantRole:
    | "owner"
    | "counterparty"
    | "carrier"
    | "inspector"
    | "other";
}> {
  const result = await pool.query<{
    owner_tenant_id: string;
  }>(
    `
    SELECT r.tenant_id AS owner_tenant_id
    FROM resources r
    WHERE r.id = $1
    LIMIT 1
    `,
    [resourceId]
  );

  const row = result.rows[0];

  if (!row) {
    throw new Error("Resource not found");
  }

  if (row.owner_tenant_id !== auth.tenantId) {
    throw new Error("FORBIDDEN");
  }

  return {
    ownerTenantId: row.owner_tenant_id,
    participantRole: "owner"
  };
}
