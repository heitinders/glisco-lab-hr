import type { AuditAction, Prisma } from '@prisma/client';
import { db } from '@/lib/db';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AuditEntryParams {
  companyId: string;
  actorId?: string | null;
  action: AuditAction;
  resource: string;
  resourceId: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

// ---------------------------------------------------------------------------
// Fields excluded from change tracking by default
// ---------------------------------------------------------------------------

const IGNORED_FIELDS = new Set(['createdAt', 'updatedAt']);

// ---------------------------------------------------------------------------
// createAuditEntry
// ---------------------------------------------------------------------------
// Returns a plain data object suitable for `db.auditLog.create({ data })`.
// NOT executed — designed to be composed inside a `db.$transaction()` call.
// ---------------------------------------------------------------------------

export function createAuditEntry(
  params: AuditEntryParams,
) {
  return {
    companyId: params.companyId,
    actorId: params.actorId ?? null,
    action: params.action,
    resource: params.resource,
    resourceId: params.resourceId,
    before: params.before ?? undefined,
    after: params.after ?? undefined,
    ipAddress: params.ipAddress ?? undefined,
    userAgent: params.userAgent ?? undefined,
  };
}

// ---------------------------------------------------------------------------
// buildChanges
// ---------------------------------------------------------------------------
// Computes a field-level diff between two record snapshots.
//
// - Skips fields prefixed with underscore.
// - Skips `createdAt` / `updatedAt` by default.
// - Skips fields where both old and new values are `undefined`.
// - Uses JSON.stringify for deep equality comparison.
// - Replaces values with '[REDACTED]' for fields listed in `sensitiveFields`.
// ---------------------------------------------------------------------------

export function buildChanges(
  oldRecord: Record<string, unknown>,
  newRecord: Record<string, unknown>,
  sensitiveFields?: string[],
): Record<string, { old: unknown; new: unknown }> {
  const sensitiveSet = new Set(sensitiveFields ?? []);
  const changes: Record<string, { old: unknown; new: unknown }> = {};

  // Collect every key that appears in either record
  const allKeys = new Set([
    ...Object.keys(oldRecord),
    ...Object.keys(newRecord),
  ]);

  for (const key of allKeys) {
    // Skip internal / auto-managed fields
    if (key.startsWith('_') || IGNORED_FIELDS.has(key)) {
      continue;
    }

    const oldVal = oldRecord[key];
    const newVal = newRecord[key];

    // Skip when both sides are undefined (field absent from both)
    if (oldVal === undefined && newVal === undefined) {
      continue;
    }

    // Deep equality via JSON serialisation
    if (JSON.stringify(oldVal) === JSON.stringify(newVal)) {
      continue;
    }

    if (sensitiveSet.has(key)) {
      changes[key] = { old: '[REDACTED]', new: '[REDACTED]' };
    } else {
      changes[key] = { old: oldVal ?? null, new: newVal ?? null };
    }
  }

  return changes;
}

// ---------------------------------------------------------------------------
// withAudit
// ---------------------------------------------------------------------------
// Executes a mutation and creates an audit log entry in a single Prisma
// interactive transaction.  The supplied `operation` callback receives the
// transactional client so all writes share the same connection/rollback scope.
// ---------------------------------------------------------------------------

export async function withAudit<T>(
  params: AuditEntryParams,
  operation: (tx: Parameters<Parameters<typeof db.$transaction>[0]>[0]) => Promise<T>,
): Promise<T> {
  return db.$transaction(async (tx) => {
    const result = await operation(tx);

    await tx.auditLog.create({
      data: createAuditEntry(params),
    });

    return result;
  });
}
