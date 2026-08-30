import { pool } from "../config/database.js";
import type { AuthContext } from "./auth-context.js";

export async function resolveAuthContext(
  externalSubject: string,
  email?: string
): Promise<AuthContext | null> {
  const result = await pool.query<{
    user_id: string;
    tenant_id: string;
    role: "owner" | "admin" | "member";
  }>(
    `
    SELECT
      u.id AS user_id,
      tm.tenant_id,
      tm.role
    FROM users u
    JOIN tenant_memberships tm
      ON tm.user_id = u.id
    WHERE u.external_subject = $1
    ORDER BY tm.created_at ASC
    LIMIT 1
    `,
    [externalSubject]
  );

  const row = result.rows[0];

  if (row) {
    return {
      userId: row.user_id,
      tenantId: row.tenant_id,
      role: row.role
    };
  }

  if (!email) {
    return null;
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const tenantSlug = `user-${externalSubject.slice(-8)}`;

    const tenant = await client.query<{ id: string }>(
      `
      INSERT INTO tenants (name, slug)
      VALUES ($1, $2)
      RETURNING id
      `,
      [email, tenantSlug]
    );

    const user = await client.query<{ id: string }>(
      `
      INSERT INTO users (external_subject, email)
      VALUES ($1, $2)
      RETURNING id
      `,
      [externalSubject, email]
    );

    await client.query(
      `
      INSERT INTO tenant_memberships (tenant_id, user_id, role)
      VALUES ($1, $2, 'owner')
      `,
      [tenant.rows[0].id, user.rows[0].id]
    );

    await client.query("COMMIT");

    return {
      userId: user.rows[0].id,
      tenantId: tenant.rows[0].id,
      role: "owner"
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
