import { randomUUID } from "node:crypto";
import { pool } from "../config/database.js";
import type { AuthContext } from "./auth-context.js";
import { servicesPromise } from "./application.js";
import {
  createEvidenceEvent,
  type CreateEvidenceEventInput
} from "@vsl/vsl-core";


export async function protectEvidence(
  auth: AuthContext,
  resourceId: string,
  requestId?: string
) {
  const { batchService } = await servicesPromise;

  const retried =
    await batchService.retryUnanchoredBatchForResource(
      auth.tenantId,
      resourceId,
      auth.userId,
      requestId
    );

  if (retried) {
    return {
      status: "protected" as const,
      batch: retried
    };
  }

  const batch = await batchService.createPendingBatch(
    auth.tenantId,
    100,
    auth.userId,
    requestId
  );

  if (!batch) {
    return {
      status: "already_protected" as const,
      batch: null
    };
  }

  const anchored = await batchService.anchorBatch(
    auth.tenantId,
    batch.id,
    auth.userId,
    requestId
  );

  return {
    status: "protected" as const,
    batch: anchored
  };
}

export async function createEvent(
  auth: AuthContext,
  resourceId: string,
  input: Omit<
    CreateEvidenceEventInput<Record<string, unknown>>,
    | "eventId"
    | "resourceId"
    | "resourceType"
    | "version"
    | "previousStateHash"
    | "actorId"
    | "timestamp"
  >,
  requestId?: string
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
        AND tenant_id = $2
      FOR UPDATE
      `,
      [resourceId, auth.tenantId]
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
      actorId: auth.userId,
      timestamp: new Date().toISOString(),
      eventId: randomUUID(),
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
        "EVIDENCE_CREATED",
        "success",
        resourceId,
        requestId ?? null,
        JSON.stringify({
          eventId: event.eventId,
          eventType: event.eventType,
          version: event.version,
          stateHash: event.stateHash
        })
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
