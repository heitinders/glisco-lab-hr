# Architecture Decisions

## ADR-001: Next.js App Router with RSC (2025-01-01)
**Status:** active
**Decision:** Use Next.js App Router with React Server Components as default
**Context:** Reduces client-side JS, better SEO, natural data fetching patterns
**Alternatives rejected:** Pages Router (deprecated), separate API layer

## ADR-002: Prisma over raw SQL (2025-01-01)
**Status:** active
**Decision:** All DB access through Prisma ORM, no raw SQL except for migrations
**Context:** Type safety, audit trail easier, relation management
**Alternatives rejected:** Drizzle (less mature ecosystem)

## ADR-003: RBAC enforced at API layer (2025-01-01)
**Status:** active
**Decision:** Permission checks run in every API route handler, not just middleware
**Context:** Defense in depth; middleware alone is insufficient for fine-grained control
**Rule:** Every API route must call checkPermission(session, 'permission:name')

## ADR-004: Audit log is atomic (2025-01-01)
**Status:** active
**Decision:** All mutations wrap in Prisma transactions that include AuditLog write
**Context:** Ensures no mutation escapes the audit trail
**Pattern:** See .memory/patterns.md#audit-transaction

## ADR-005: PII encryption at field level (2025-01-01)
**Status:** active
**Decision:** SSN, Aadhaar, PAN, bank details encrypted with AES-256-GCM before storage
**Context:** Compliance with US/India data privacy regulations
**Key management:** ENCRYPTION_KEY env var, never in DB

## ADR-006: Performance review submission uses type-based routing (2026-03-16)
**Status:** active
**Decision:** PATCH /api/performance/reviews/[id] routes to type-specific handlers (SELF, MANAGER, HR) rather than a single monolithic handler. Each handler has its own Zod schema, ownership checks, and status transition logic.
**Context:** Review types have fundamentally different ownership rules (subject vs reviewer vs HR permission), different payloads, and different side effects (e.g., self-review completion triggers manager review readiness). Separate handlers prevent accidentally mixing these concerns.
**Rules:**
- SELF: only subjectId === session.employeeId; advances MANAGER review to MANAGER_REVIEW status
- MANAGER: only reviewerId === session.employeeId; requires MANAGER_REVIEW status; calculates overallRating as avg(self + manager)
- HR: requires performance:manage_cycles permission; finalRating overrides overallRating

## ADR-007: Peer review creation is HR-only (2026-03-16)
**Status:** active
**Decision:** POST /api/performance/reviews creates PEER review records. Only HR admins (performance:manage_cycles) can create them, assigning a specific reviewer to a subject.
**Context:** Self and Manager reviews are auto-created during cycle activation (ADR-006). Peer reviews require manual assignment by HR to avoid bias and ensure balanced feedback distribution.

## ADR-008: Review cycles created inactive, activated via PATCH (2026-03-16)
**Status:** active
**Decision:** POST /api/performance/cycles creates the cycle with isActive=false. PATCH with isActive=true triggers bulk PerformanceReview creation for all active employees (SELF + MANAGER types). companyId never accepted from the client — always injected from session.
**Context:** Separating cycle creation from review-record provisioning avoids partial state if employee data changes between creation and intended start. Activation is idempotent via skipDuplicates.
**Rule:** Zod createReviewCycleSchema must NOT include companyId.

## ADR-009: Job posting status transitions are server-enforced (2026-03-16)
**Status:** active
**Decision:** PATCH /api/recruitment/jobs/[id] enforces a finite state machine for JobStatus transitions. The valid transition map is defined as a const at module scope. postedAt is auto-set on first transition to OPEN. DELETE is restricted to DRAFT status with zero candidates.
**Context:** Preventing invalid status jumps (e.g., DRAFT -> CLOSED, FILLED -> OPEN) avoids data integrity issues in the recruitment pipeline. Candidates tied to a job must not be orphaned.
**Rules:**
- DRAFT -> OPEN, FILLED
- OPEN -> ON_HOLD, CLOSED, FILLED
- ON_HOLD -> OPEN, CLOSED, FILLED
- CLOSED -> OPEN, FILLED
- FILLED -> (terminal, no outgoing)

## ADR-010: Job.department Prisma relation added (2026-03-16)
**Status:** active
**Decision:** Added `department Department? @relation(fields: [departmentId], references: [id])` to the Job model and `jobs Job[]` to Department. Previously departmentId was a plain string field with no Prisma relation.
**Context:** The recruitment jobs API needs to include department name in list and detail responses. Without the relation, Prisma `include: { department: ... }` would fail at runtime.

## ADR-011: Document access uses role-based scoping, not permission-only (2026-03-16)
**Status:** active
**Decision:** GET /api/documents does NOT use a single `checkPermission()` gate. Instead, the route authenticates the user and then scopes the Prisma query based on role: EMPLOYEE sees own docs, MANAGER sees own + direct reports, HR+ sees all in company. This avoids the need for separate endpoints per role.
**Context:** Documents span multiple access tiers. A blanket `documents:view_all` check would block employees from seeing their own documents. The dual-role-access pattern (see .memory/patterns.md) is used instead.
**Rules:**
- HR+ roles: SUPER_ADMIN, HR_ADMIN, HR_MANAGER — unrestricted within company
- MANAGER: own employeeId + employees where reportingToId = session.employeeId
- EMPLOYEE: own employeeId only
- Company boundary enforced via `employee: { companyId }` relation filter

## ADR-012: documents:manage permission added for HR+ template/delete operations (2026-03-16)
**Status:** active
**Decision:** Added `documents:manage` permission (SUPER_ADMIN, HR_ADMIN, HR_MANAGER) to the RBAC matrix. This gates template rendering and document deletion. `documents:upload` was expanded to include MANAGER and EMPLOYEE roles (with ownership constraints enforced in route logic). `documents:view_own` was expanded to include MANAGER.
**Context:** The original permissions only had view_own, view_all, upload (HR-only), and delete. The document management feature requires EMPLOYEE/MANAGER upload capability with server-side ownership enforcement, plus a separate manage permission for template rendering and hard deletes.

## ADR-014: Reports module uses server-side generator with role-scoped filtering (2026-03-16)
**Status:** active
**Decision:** Reports are generated server-side via `generateReport(type, companyId, filters)` in `@/lib/reports/generator.ts`. The API route at `/api/reports/[type]` enforces RBAC via `reports:view` permission and scopes MANAGER role queries to their direct reports by injecting `managerId` into filters.
**Context:** Reports aggregate sensitive data across employees, payroll, and compliance. Server-side generation ensures data access rules are enforced consistently, prevents client-side data leakage, and allows the generator to be reused by future scheduled reports or PDF export features.
**Rules:**
- HR+ roles (SUPER_ADMIN, HR_ADMIN, HR_MANAGER, FINANCE): see all company data
- MANAGER: filtered to `reportingToId = session.employeeId`
- Report types: headcount, leave, payroll, turnover, compliance
- No audit log for reads (GET-only, no mutations)
- CSV export is client-side from the fetched data array

## ADR-015: Role management restricted to SUPER_ADMIN with last-admin guard (2026-03-16)
**Status:** active
**Decision:** PATCH /api/users/[id]/role is gated by `users:manage_roles` (SUPER_ADMIN only). The endpoint prevents self-demotion and demoting the last SUPER_ADMIN. Role changes use `withAudit()` + `buildChanges()` for atomic audit logging.
**Context:** Role assignment is the highest-privilege mutation in the system. Restricting to SUPER_ADMIN and preventing the last admin from being demoted avoids accidental lockout. Audit trail captures before/after role values.
**Rules:**
- Cannot change your own role (returns 422)
- Cannot demote last active SUPER_ADMIN in company (returns 422)
- Only valid UserRole enum values accepted (Zod validation)

## ADR-016: Audit log viewer restricted to SUPER_ADMIN and HR_ADMIN (2026-03-16)
**Status:** active
**Decision:** GET /api/audit-log is gated by `audit:view` permission (SUPER_ADMIN, HR_ADMIN). Supports server-side filtering by action, resource, actorId, and date range. Includes actor email/role via Prisma `include`. Client-side CSV export.
**Context:** Audit logs contain sensitive operational data. Limiting access to top-level roles ensures compliance visibility without exposing system internals to regular employees. CSV export is client-side from the current page of results.

## ADR-017: Users list endpoint separated from employees (2026-03-16)
**Status:** active
**Decision:** GET /api/users returns User records (with linked Employee name) and is gated by `users:list` (SUPER_ADMIN, HR_ADMIN). This is distinct from GET /api/employees which returns Employee records with department/designation. The User endpoint excludes passwordHash via Prisma `select`.
**Context:** The roles management page needs User-centric data (role, isActive, lastLogin) rather than Employee-centric data (department, designation, employment type). Separate endpoints maintain clear domain boundaries.

## ADR-013: Upload route uses data URI stub pending UploadThing/S3 (2026-03-16)
**Status:** active
**Decision:** POST /api/upload accepts JSON `{ fileName, fileType, fileSize, base64Data }`, validates type and size via Zod, and returns a data URI. This is explicitly a development stub.
**Context:** UploadThing integration requires env vars and package configuration that may not be available in all environments. The data URI approach allows end-to-end document flow testing without external dependencies. The route includes TODO comments with UploadThing and S3 migration code snippets.

## ADR-018: Cron jobs use Bull repeatable jobs on a dedicated queue (2026-03-16)
**Status:** active
**Decision:** Automated notifications (birthday, anniversary, probation, document expiry, leave balance) run as Bull repeatable jobs on a dedicated `cron` queue in `src/lib/queue/cron.ts`. Each job type is a named repeatable with a UTC cron expression. `registerCronJobs()` is called on worker startup and is idempotent.
**Context:** Bull's `repeat: { cron }` option provides reliable, distributed cron scheduling backed by Redis. A dedicated queue separates cron concerns from request-driven job queues (email, pdf, payroll). Each processor is isolated so one failure does not block other cron types. Date matching for birthdays and anniversaries uses in-JS filtering because Prisma does not support month/day extraction from DateTime columns (per ADR-002, no raw SQL).
**Rules:**
- Cron expressions are in UTC; ET offsets documented in code comments
- All date math uses date-fns + date-fns-tz with explicit SCHEDULE_TZ constant
- HR admin lookup queries employees with HR-level User.role (SUPER_ADMIN, HR_ADMIN, HR_MANAGER)
- `notifyMany()` uses `Promise.allSettled` so one recipient failure does not block others
- Stale repeatable jobs are cleaned up during registration
