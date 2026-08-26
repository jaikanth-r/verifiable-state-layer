import { pool } from "../config/database.js";
import type { AuthContext } from "./auth-context.js";

export async function canAccessResource(
  auth: AuthContext,
  resourceId: string
): Promise<boolean> {
  const result = await pool.query(
    `
    SELECT 1
    FROM resources r
    WHERE r.id = $1
      AND (
        r.tenant_id = $2
        OR EXISTS (
          SELECT 1
          FROM resource_participants rp
          WHERE rp.resource_id = r.id
            AND rp.tenant_id = $2
        )
      )
    LIMIT 1
    `,
    [resourceId, auth.tenantId]
  );

  return result.rowCount === 1;
}

export async function requireResourceAccess(
  auth: AuthContext,
  resourceId: string
): Promise<void> {
  if (!(await canAccessResource(auth, resourceId))) {
    throw new Error("Resource not found");
  }
}
