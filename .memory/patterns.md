# Reusable Patterns

## audit-transaction
All mutations that write to the DB must also write an AuditLog entry in the same transaction.

## api-route-structure
Every API route must follow:
1. const session = await getServerSession(authOptions) — auth check
2. checkPermission(session, 'resource:action') — RBAC check
3. schema.parse(body) — Zod validation
4. Business logic
5. Audit log (in transaction)
6. Return typed response

## leave-day-calculation
Always use date-fns-tz with employee's timezone. Exclude weekends + holidays from day count.

## sensitive-field-access
Sensitive fields (SSN, Aadhaar, bank details) require employee:read_sensitive permission.
Strip these fields in Prisma select unless explicitly permitted.

## pii-field-encryption
Use `encryptFields` / `decryptFields` from `@/lib/encryption` for PII before storage.
The canonical list lives in `SENSITIVE_EMPLOYEE_FIELDS`.

```ts
import { encryptFields, decryptFields, SENSITIVE_EMPLOYEE_FIELDS } from '@/lib/encryption';

// Before Prisma create/update:
const safe = encryptFields(data, [...SENSITIVE_EMPLOYEE_FIELDS]);

// After Prisma read (when caller has employee:read_sensitive):
const plain = decryptFields(record, [...SENSITIVE_EMPLOYEE_FIELDS]);
```

Storage format: base64(iv 12B + authTag 16B + ciphertext). Key from ENCRYPTION_KEY env var.

## dual-role-access
For endpoints accessible by both HR+ and regular employees, use `hasPermission()` to
branch logic rather than throwing on the first `checkPermission()` call. HR+ gets the
full dataset; regular employees get only their own records. The non-HR path still calls
`checkPermission(session, 'resource:action_self')` to verify basic auth.

```ts
const isHrPlus = hasPermission(userRole, 'performance:view_all');
if (!isHrPlus) {
  await checkPermission(session, 'performance:review_self');
}
// ... then scope queries based on isHrPlus
```

## performance-review-submission
Performance review submissions use type-based routing in PATCH /api/performance/reviews/[id].
The review.type field determines which handler runs:

- **SELF**: `selfReviewSubmissionSchema` — ownership = subjectId. Side effect: sets MANAGER
  review status to MANAGER_REVIEW via `updateMany`.
- **MANAGER**: `managerReviewSubmissionSchema` — ownership = reviewerId. Guard: status must be
  MANAGER_REVIEW. Calculates overallRating = avg(selfRating, managerRating).
- **HR**: `hrReviewSubmissionSchema` — RBAC = `performance:manage_cycles`. finalRating
  overrides overallRating.

Re-submission guard: once `submittedAt` is set, further PATCH returns 409.

## peer-review-creation
POST /api/performance/reviews creates PEER review assignments.
- Permission: `performance:manage_cycles` (HR only)
- Validates: cycleId exists, subject/reviewer exist in same company, not self-assignment
- Duplicate check: unique constraint on (cycleId, subjectId, reviewerId, type) — returns 409
- Initial status: PEER_REVIEW

## cycle-activation-pattern
Review cycles are created in an inactive (isActive=false) state. Activation (PATCH with
isActive=true) triggers bulk creation of PerformanceReview records:
- SELF reviews: subjectId = reviewerId = employee.id
- MANAGER reviews: subjectId = employee, reviewerId = reportingToId (when present)
Uses `createMany({ skipDuplicates: true })` for idempotent re-activation.

## job-status-transition
PATCH /api/recruitment/jobs/[id] enforces a strict status state machine via a
`VALID_TRANSITIONS` map at module scope. Before applying a status change, the handler:
1. Fetches the existing record (also needed for `buildChanges` audit diff)
2. Checks `VALID_TRANSITIONS[existing.status].includes(newStatus)`
3. Returns 422 with `allowedTransitions` array if invalid
4. Auto-sets `postedAt = new Date()` on first transition to OPEN

## withAudit-resourceId-for-creates
For CREATE operations where the record id is not known until after `tx.*.create()`,
extract the `auditParams` object into a `const` before calling `withAudit()`. Inside
the callback, mutate `auditParams.resourceId = created.id`. Because `withAudit` writes
the audit log AFTER the callback returns and JS objects are passed by reference, the
audit entry will contain the real id.

## document-role-scoped-access
Document listing (GET /api/documents) uses role-based query scoping rather than a
single permission gate. The pattern builds an `allowedEmployeeIds` array:

- **HR+** (SUPER_ADMIN, HR_ADMIN, HR_MANAGER): `allowedEmployeeIds = undefined` (no filter)
- **MANAGER**: `[sessionEmployeeId, ...directReportIds]`
- **EMPLOYEE**: `[sessionEmployeeId]`

If a `?employeeId=` filter is provided, it is intersected with allowedEmployeeIds.
Company boundary is always enforced via `employee: { companyId }` relation filter.

```ts
const HR_PLUS_ROLES = ['SUPER_ADMIN', 'HR_ADMIN', 'HR_MANAGER'];
let allowedEmployeeIds: string[] | undefined;

if (HR_PLUS_ROLES.includes(userRole)) {
  allowedEmployeeIds = undefined;
} else if (userRole === 'MANAGER') {
  const reports = await db.employee.findMany({
    where: { reportingToId: sessionEmployeeId },
    select: { id: true },
  });
  allowedEmployeeIds = [sessionEmployeeId, ...reports.map(r => r.id)];
} else {
  allowedEmployeeIds = [sessionEmployeeId];
}
```

## document-expiry-warning
When listing documents, add a computed `isExpiring: boolean` flag to each result.
A document is expiring if `expiresAt` exists and is within 30 days of the current date.
Uses `addDays(now, 30)` from date-fns for consistent calculation.

## report-generation
Reports are generated via `generateReport(type, companyId, filters)` from `@/lib/reports/generator.ts`.
Each report type returns `{ data, columns, summary }` where:
- `data`: array of flat row objects for the table
- `columns`: `{ key, label }[]` describing table structure
- `summary`: scalar stats for summary cards + optional nested objects for breakdowns

The API route at `/api/reports/[type]` adds MANAGER scoping via `filters.managerId`.
The client hook `useReport(type, filters)` from `@/hooks/use-reports.ts` wraps TanStack Query.

CSV export is client-side: build from `data` + `columns`, trigger download via `Blob` + `URL.createObjectURL`.

Valid report types are enforced via `VALID_REPORT_TYPES` const array in the generator.

## role-management
PATCH /api/users/[id]/role uses `withAudit()` with `buildChanges()` for atomic role updates.
Guards:
1. `checkPermission(session, 'users:manage_roles')` — SUPER_ADMIN only
2. Cannot change own role (targetUserId !== currentUserId)
3. Cannot demote last SUPER_ADMIN — count active SUPER_ADMINs before allowing demotion
4. Zod validates role is valid enum value
5. Company boundary enforced via `targetUser.companyId !== session.companyId`

## audit-log-viewer
GET /api/audit-log supports server-side filtering:
- `action` (AuditAction enum)
- `resource` (string, e.g., 'User', 'Employee')
- `actorId` (User.id)
- `dateFrom`, `dateTo` (ISO date strings, dateTo is inclusive of entire day)
- Standard pagination (page, pageSize)

Includes actor relation (email, role) via `include`. CSV export is client-side.

## settings-hooks
`@/hooks/use-settings.ts` exports:
- `useUsers(filters?)` — GET /api/users with queryKey ['users', filters]
- `useUpdateUserRole(userId)` — PATCH mutation, invalidates ['users']
- `useAuditLog(filters?)` — GET /api/audit-log with queryKey ['audit-log', filters]

All use `apiClient` from `@/lib/api` and follow the same pattern as `use-employees.ts`.

## template-variable-replacement
Template rendering replaces `{{variableName}}` placeholders (with optional whitespace
around the variable name) using a global regex per variable. The regex escapes special
characters in variable names to prevent ReDoS. Unmatched placeholders are preserved
in the output so callers can detect missing variables.

## cron-job-pattern
Cron jobs live in `src/lib/queue/cron.ts`. Each job follows this structure:

1. Export a `processXxx()` async function that queries the DB and sends notifications
2. Add the job type to the `CronJobData['jobType']` union
3. Add a case to `processCronJob()` router switch
4. Add a `CronSchedule` entry to the `CRON_SCHEDULES` array

Key conventions:
- Use `toZonedTime(new Date(), SCHEDULE_TZ)` for timezone-aware "today" calculations
- Use `notifyMany()` helper for multi-recipient notifications (uses `Promise.allSettled`)
- Use `getHrAdminIds(companyId)` to resolve HR notification recipients
- Each processor has its own try/catch per employee — one failure does not stop the batch
- `registerCronJobs()` is idempotent and cleans up stale repeatables on startup

```ts
// Example: adding a new daily cron job
export async function processNewReminder(): Promise<{ processed: number }> {
  const now = toZonedTime(new Date(), SCHEDULE_TZ);
  // ... query + notify logic
  return { processed: count };
}
// Then add to processCronJob switch + CRON_SCHEDULES array
```
