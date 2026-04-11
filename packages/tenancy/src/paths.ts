import path from 'node:path';
import { InvalidTenantIdError, TenantIdSchema, type TenantId } from '@levelup/shared';

const TENANT_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;

/**
 * Resolves the absolute directory for a tenant, with two independent
 * defenses against path traversal:
 *
 *   1. A strict regex on the tenantId itself
 *   2. An assertion that the joined path stays under dataRoot/tenants
 *
 * Either check alone would be sufficient. Having both means a future
 * refactor that loosens one still won't let an attacker escape.
 */
export function resolveTenantDir(dataRoot: string, tenantId: string): string {
  if (!TENANT_ID_RE.test(tenantId)) {
    throw new InvalidTenantIdError(tenantId);
  }
  const tenantsRoot = path.resolve(dataRoot, 'tenants');
  const dir = path.resolve(tenantsRoot, tenantId);
  if (!dir.startsWith(tenantsRoot + path.sep)) {
    throw new InvalidTenantIdError(tenantId);
  }
  return dir;
}

export function parseTenantId(raw: string): TenantId {
  return TenantIdSchema.parse(raw);
}
