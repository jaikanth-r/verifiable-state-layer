import { pool } from "../config/database.js";

import type { AuthContext } from "./auth-context.js";

export interface CreateResourceInput {
  resourceType: string;
}

export interface ResourceRecord {
  id: string;
  resourceType: string;
  externalId: string;
  createdAt: string;
}

function referenceSlug(recordType: string): string {
  return recordType
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "RECORD";
}

export async function createResource(
  auth: AuthContext,
  input: CreateResourceInput,
  requestId?: string
): Promise<ResourceRecord> {
  const client = await pool.connect();
  let externalId = "";

  try {
    await client.query("BEGIN");

    const year = new Date().getUTCFullYear();
    const slug = referenceSlug(input.resourceType);

    await client.query(
      "SELECT pg_advisory_xact_lock(hashtext($1))",
      [`${slug}:${year}`]
    );

    const counter = await client.query<{ next_number: string }>(
      `
      INSERT INTO resource_reference_counters (
        record_type,
        reference_year,
        next_number
      )
      VALUES ($1, $2, 2)
      ON CONFLICT (record_type, reference_year)
      DO UPDATE
      SET next_number =
        resource_reference_counters.next_number + 1
      RETURNING next_number - 1 AS next_number
      `,
      [slug, year]
    );

    const sequence = Number(counter.rows[0]?.next_number);

    if (!Number.isSafeInteger(sequence) || sequence <= 0) {
      throw new Error("Unable to generate resource reference");
    }

    externalId =
      `VSL-${slug}-${year}-${String(sequence).padStart(6, "0")}`;

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


export async function listResources(
  auth: AuthContext
): Promise<ResourceRecord[]> {
  const result = await pool.query<{
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
    `,
    [auth.tenantId]
  );

  return result.rows.map((row) => ({
    id: row.id,
    resourceType: row.resource_type,
    externalId: row.external_id,
    createdAt: row.created_at.toISOString()
  }));
}
