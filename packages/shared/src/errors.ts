export class LevelUpError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class TenantNotFoundError extends LevelUpError {
  constructor(tenantId: string) {
    super(`Tenant not found: ${tenantId}`, 'TENANT_NOT_FOUND', 404);
  }
}

export class InvalidTenantIdError extends LevelUpError {
  constructor(tenantId: string) {
    super(`Invalid tenantId: ${tenantId}`, 'INVALID_TENANT_ID', 400);
  }
}

export class TenantAlreadyExistsError extends LevelUpError {
  constructor(tenantId: string) {
    super(`Tenant already exists: ${tenantId}`, 'TENANT_EXISTS', 409);
  }
}

export class UnauthorizedError extends LevelUpError {
  constructor(message = 'Unauthorized') {
    super(message, 'UNAUTHORIZED', 401);
  }
}

export class ForbiddenError extends LevelUpError {
  constructor(message = 'Forbidden') {
    super(message, 'FORBIDDEN', 403);
  }
}
