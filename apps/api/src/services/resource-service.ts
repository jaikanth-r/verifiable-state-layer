import { randomUUID } from "node:crypto";
import { pool } from "../config/database.js";

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
  input: CreateResourceInput
): Promise<ResourceRecord> {
  const externalId = input.externalId ?? randomUUID();

  const result = await pool.query<{
    id: string;
    resource_type: string;
    external_id: string;
    created_at: Date;
  }>(
    `
    INSERT INTO resources (
      resource_type,
      external_id
    )
    VALUES ($1, $2)
    RETURNING
      id,
      resource_type,
      external_id,
      created_at
    `,
    [input.resourceType, externalId]
  );

  const row = result.rows[0];

  return {
    id: row.id,
    resourceType: row.resource_type,
    externalId: row.external_id,
    createdAt: row.created_at.toISOString()
  };
}
