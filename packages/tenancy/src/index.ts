export type { TenantContext, TenantDb, WorkspaceFs, VectorStore } from './context.js';
export { TenantRegistry, createTenantRegistry } from './registry.js';
export type { TenantRegistryOptions, RegistryStats } from './registry.js';
export { resolveTenantDir } from './paths.js';
export { createWorkspaceFs } from './workspace-fs.js';
export { runTenantMigrations } from './migrations.js';
export { acquireLock, withLock } from './file-lock.js';
export type { FileLock } from './file-lock.js';
