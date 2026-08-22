import type { AuthContext } from "./auth-context.js";

const ROLE_LEVEL: Record<AuthContext["role"], number> = {
  member: 1,
  admin: 2,
  owner: 3
};

export function hasRole(
  auth: AuthContext,
  minimumRole: AuthContext["role"]
): boolean {
  return ROLE_LEVEL[auth.role] >= ROLE_LEVEL[minimumRole];
}

export function requireRole(
  auth: AuthContext,
  minimumRole: AuthContext["role"]
): void {
  if (!hasRole(auth, minimumRole)) {
    throw new Error("FORBIDDEN");
  }
}
