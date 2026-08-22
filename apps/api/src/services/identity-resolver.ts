import { pool } from "../config/database.js";
import type { AuthContext } from "./auth-context.js";

export async function resolveAuthContext(
  externalSubject: string
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

  if (!row) {
    return null;
  }

  return {
    userId: row.user_id,
    tenantId: row.tenant_id,
    role: row.role
  };
}
