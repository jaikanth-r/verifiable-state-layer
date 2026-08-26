import { pool } from "../config/database.js";
import type { AuthContext } from "./auth-context.js";
import { requireResourceAccess } from "./resource-access.js";

export async function getResourceHistory(
  auth: AuthContext,
  resourceId: string
) {
  await requireResourceAccess(auth, resourceId);

  const result = await pool.query<{
    version: number;
    event_id: string;
    event_type: string;
    actor_id: string;
    occurred_at: Date;
    state: unknown;
    state_hash: string;
    previous_state_hash: string | null;
  }>(
    `
    SELECT
      rv.version,
      ee.event_id,
      ee.event_type,
      ee.actor_id,
      ee.occurred_at,
      rv.state,
      rv.state_hash,
      rv.previous_state_hash
    FROM resource_versions rv
    JOIN evidence_events ee
      ON ee.version_id = rv.id
    WHERE rv.resource_id = $1
    ORDER BY rv.version ASC
    `,
    [resourceId]
  );

  return result.rows.map((row) => ({
    version: row.version,
    eventId: row.event_id,
    eventType: row.event_type,
    actorId: row.actor_id,
    timestamp: row.occurred_at.toISOString(),
    state: row.state,
    stateHash: row.state_hash,
    previousStateHash: row.previous_state_hash
  }));
}
