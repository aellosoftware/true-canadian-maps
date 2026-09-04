import { createAccessControl } from "better-auth/plugins/access";
import { adminAc, defaultStatements, memberAc, ownerAc } from "better-auth/plugins/organization/access";

/**
 * Permission vocabulary for the studio. Roles are org-scoped.
 *   owner  – everything, including deleting the organization
 *   admin  – everything except deleting the organization
 *   editor – build and publish maps; no member or key management
 *   viewer – read-only
 */
export const statements = {
  ...defaultStatements,
  project: ["create", "read", "update", "delete", "publish"],
  style: ["read", "update"],
  marker: ["read", "update"],
  icon: ["read", "update"],
  apikey: ["read", "manage"],
  audit: ["read"],
} as const;

export const ac = createAccessControl(statements);

export const viewer = ac.newRole({
  project: ["read"],
  style: ["read"],
  marker: ["read"],
  icon: ["read"],
  apikey: ["read"],
  audit: [],
});

export const editor = ac.newRole({
  project: ["create", "read", "update", "publish"],
  style: ["read", "update"],
  marker: ["read", "update"],
  icon: ["read", "update"],
  apikey: ["read"],
  audit: ["read"],
});

export const admin = ac.newRole({
  ...adminAc.statements,
  project: ["create", "read", "update", "delete", "publish"],
  style: ["read", "update"],
  marker: ["read", "update"],
  icon: ["read", "update"],
  apikey: ["read", "manage"],
  audit: ["read"],
});

export const owner = ac.newRole({
  ...ownerAc.statements,
  project: ["create", "read", "update", "delete", "publish"],
  style: ["read", "update"],
  marker: ["read", "update"],
  icon: ["read", "update"],
  apikey: ["read", "manage"],
  audit: ["read"],
});

// memberAc is Better Auth's default "member" role; we keep our own names but re-export for completeness.
export const roles = { owner, admin, editor, viewer } as const;
export type RoleName = keyof typeof roles;
export const ROLE_NAMES = Object.keys(roles) as RoleName[];

export type Permission = { [K in keyof typeof statements]?: readonly (typeof statements)[K][number][] };

/** Pure permission check for a role name (used by API handlers without a round-trip). */
export function roleHasPermission(role: string, permission: Permission): boolean {
  const r = roles[role as RoleName];
  if (!r) return false;
  return r.authorize(permission as never).success;
}

void memberAc;
