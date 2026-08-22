import type {
  AuditWrite,
  AuditWriter
} from "@vsl/vsl-core";
import type { PoolClient } from "pg";

import { pool } from "../config/database.js";

export class PostgresAuditWriter implements AuditWriter {
  async write(
    event: AuditWrite,
    client?: PoolClient
  ): Promise<void> {
    const db = client ?? pool;

    await db.query(
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
        event.tenantId ?? null,
        event.userId ?? null,
        event.action,
        event.outcome,
        event.resourceId ?? null,
        event.requestId ?? null,
        JSON.stringify(event.metadata ?? {})
      ]
    );
  }
}
