import { randomUUID } from "node:crypto";

import { pool } from "../config/database.js";

import type { AuthContext } from "./auth-context.js";

export interface CreateResourceInput {
  resourceType: string;
  externalId?: string;
}

export interface ResourceRecord {
  id: string;
  resourceType: string;
  externalId: string;
  createdAt: string;
}

export async function createResource(
  auth: AuthContext,
  input: CreateResourceInput,
  requestId?: string
): Promise<ResourceRecord> {
  const externalId = input.externalId ?? randomUUID();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await client.query<{
      id: string;
      resource_type: string;
      external_id: string;
      created_at: Date;
    }>(
      `
      INSERT INTO resources (
        tenant_id,
        resource_type,
        external_id
      )
      VALUES ($1, $2, $3)
      RETURNING
        id,
        resource_type,
        external_id,
        created_at
      `,
      [auth.tenantId, input.resourceType, externalId]
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
        "RESOURCE_CREATED",
        "success",
        row.id,
        requestId ?? null,
        JSON.stringify({
          resourceType: row.resource_type,
          externalId: row.external_id
        })
      ]
    );

    await client.query("COMMIT");

    return {
      id: row.id,
      resourceType: row.resource_type,
      externalId: row.external_id,
      createdAt: row.created_at.toISOString()
    };
  } catch (error) {
    await client.query("ROLLBACK");

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "23505"
    ) {
      throw new Error(
        `Resource with external ID '${externalId}' already exists in this tenant`
      );
    }

    throw error;
  } finally {
    client.release();
  }
}
