import { pool } from "../config/database.js";
import {
  createEvidenceEvent,
  type CreateEvidenceEventInput
} from "@vsl/vsl-core";

export async function createEvent(
  resourceId: string,
  input: Omit<
    CreateEvidenceEventInput<Record<string, unknown>>,
    "resourceId" | "resourceType" | "version" | "previousStateHash"
  >
) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const resource = await client.query<{
      id: string;
      resource_type: string;
      external_id: string;
    }>(
      `
      SELECT id, resource_type, external_id
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

    const latest = await client.query<{
      version: number;
      state_hash: string;
    }>(
      `
      SELECT
        rv.version,
        rv.state_hash
      FROM resource_versions rv
      WHERE rv.resource_id = $1
      ORDER BY rv.version DESC
      LIMIT 1
      FOR UPDATE
      `,
      [resourceId]
    );

    const latestRow = latest.rows[0];

    const version = latestRow
      ? latestRow.version + 1
      : 1;

    const previousStateHash = latestRow
      ? latestRow.state_hash
      : null;

    const event = createEvidenceEvent({
      ...input,
      resourceId: resourceRow.external_id,
      resourceType: resourceRow.resource_type,
      version,
      previousStateHash
    });

    const versionRow = await client.query<{ id: string }>(
      `
      INSERT INTO resource_versions (
        resource_id,
        version,
        state,
        state_hash,
        previous_state_hash,
        created_by
      )
      VALUES ($1, $2, $3::jsonb, $4, $5, $6)
      RETURNING id
      `,
      [
        resourceId,
        version,
        JSON.stringify(event.state),
        event.stateHash,
        event.previousStateHash,
        event.actorId
      ]
    );

    await client.query(
      `
      INSERT INTO evidence_events (
        event_id,
        resource_id,
        version_id,
        event_type,
        actor_id,
        occurred_at,
        state_hash,
        previous_state_hash
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `,
      [
        event.eventId,
        resourceId,
        versionRow.rows[0].id,
        event.eventType,
        event.actorId,
        event.timestamp,
        event.stateHash,
        event.previousStateHash
      ]
    );

    await client.query("COMMIT");

    return event;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
