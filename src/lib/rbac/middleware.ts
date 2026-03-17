import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { hasPermission, type Permission } from './permissions';

export class AuthorizationError extends Error {
  constructor(message: string = 'Insufficient permissions') {
    super(message);
    this.name = 'AuthorizationError';
  }
}

export async function checkPermission(
  session: { user?: { role?: string } } | null,
  permission: Permission
): Promise<void> {
  if (!session?.user) {
    throw new AuthorizationError('Authentication required');
  }

  const role = session.user.role;
  if (!role || !hasPermission(role, permission)) {
    throw new AuthorizationError(`Permission '${permission}' denied for role '${role}'`);
  }
}

export function handleApiError(error: unknown): NextResponse {
  if (error instanceof AuthorizationError) {
    return NextResponse.json(
      { error: error.message },
      { status: error.message.includes('Authentication') ? 401 : 403 }
    );
  }

  if (error instanceof Error && error.name === 'ZodError') {
    return NextResponse.json(
      { error: 'Validation failed', details: JSON.parse(error.message) },
      { status: 422 }
    );
  }

  const errMsg = error instanceof Error ? error.message : String(error);
  const errStack = error instanceof Error ? error.stack : undefined;
  console.error('[API Error]', errMsg);
  if (errStack) console.error('[API Stack]', errStack);
  return NextResponse.json(
    { error: 'Internal server error', debug: errMsg },
    { status: 500 }
  );
}
