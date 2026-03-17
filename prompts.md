# GliscoHR — Build Prompts

Ordered by dependency. Each prompt is self-contained and references the conventions in `CLAUDE.md`, `docs/`, and `.memory/`.

---

## Phase 0: Foundation & Infrastructure

### P0.1 — Database Migration & Seed

```
Run the initial Prisma migration against the PostgreSQL database defined in DATABASE_URL.

Steps:
1. Run `npx prisma migrate dev --name init` to apply prisma/schema.prisma
2. Create a seed file at prisma/seed.ts that:
   - Creates one Company (Glisco Lab, regions: US + INDIA, fiscalYearStart: April)
   - Creates a SUPER_ADMIN user (email: admin@gliscolab.com, password: hashed with bcryptjs)
   - Creates 3 Departments (Engineering, Marketing, Operations)
   - Creates 5 Designations with salary bands for both US and INDIA regions
   - Creates LeaveTypeConfig entries for both regions (ANNUAL, SICK, CASUAL, MATERNITY, PATERNITY, FMLA for US, plus EARNED, COMPENSATORY for India)
   - Creates Holiday entries for 2026 (both US federal + India national holidays)
3. Add "prisma:seed" script to package.json pointing to the seed file
4. Run the seed

Follow the schema exactly as defined in prisma/schema.prisma. Use Prisma transactions for related inserts. Never commit real secrets — use placeholder passwords that get hashed at seed time.
```

### P0.2 — Auth: Connect Login Form to NextAuth

```
Wire up the login page at src/app/(auth)/login/page.tsx to actually authenticate via NextAuth.

Requirements:
1. Import signIn from next-auth/react
2. On form submit, call signIn('credentials', { email, password, redirect: false })
3. Handle response: if error, show error via sonner toast; if ok, redirect to /dashboard using next/navigation
4. Show loading state on the submit button during auth
5. Handle the account lockout error (display "Account locked, try again in 15 minutes")
6. After successful login, the session should contain: user.id, user.role, user.employeeId, user.companyId (these are set in the JWT callback in src/lib/auth.ts)

Reference:
- Auth config: src/lib/auth.ts (credentials provider, JWT callbacks already defined)
- Login page: src/app/(auth)/login/page.tsx
- Middleware: src/middleware.ts (already redirects unauthenticated users)
- Use sonner for toast notifications (not custom toast)
```

### P0.3 — Auth: Forgot Password & Reset Password Flow

```
Implement the forgot-password and reset-password flows.

Requirements:
1. POST /api/auth/forgot-password:
   - Accept { email } in body
   - Look up user by email; if not found, still return 200 (prevent enumeration)
   - Generate a secure token (crypto.randomBytes), hash it, store in VerificationToken table with 1-hour expiry
   - Send reset email via src/lib/email/sender.ts with a link to /reset-password?token=<token>
   - Create a React Email template at src/lib/email/templates/reset-password.tsx

2. POST /api/auth/reset-password:
   - Accept { token, password }
   - Validate token against VerificationToken table (check expiry)
   - Validate password strength using Zod (min 8 chars, 1 uppercase, 1 number, 1 special)
   - Hash new password with bcryptjs, update User record
   - Delete the used token
   - Reset failedLoginAttempts and lockedUntil
   - Write AuditLog entry in a Prisma transaction

3. Wire up the existing UI pages:
   - src/app/(auth)/forgot-password/page.tsx — form with email input
   - src/app/(auth)/reset-password/page.tsx — form with password + confirm password

Use sonner for all toast feedback. Follow API route pattern from src/app/api/CLAUDE.md.
```

### P0.4 — PII Encryption Utility

```
Create a field-level encryption module at src/lib/encryption.ts for sensitive PII fields.

Requirements:
1. Implement encrypt(plaintext: string): string and decrypt(ciphertext: string): string
2. Use AES-256-GCM with a key derived from ENCRYPTION_KEY env var
3. Store as base64-encoded string: iv + authTag + ciphertext
4. Add ENCRYPTION_KEY to .env.example (32-byte hex string)
5. Create a Prisma middleware or helper functions:
   - encryptFields(data, fieldNames) — encrypts specified fields before write
   - decryptFields(data, fieldNames) — decrypts specified fields after read
6. Sensitive fields to encrypt: ssnLast4, aadhaarNumber, panNumber, bankAccountNumber, bankIfscCode

This module will be used in employee create/update API routes and in the employee read route (only decrypted when user has employee:read_sensitive permission).

Reference: ADR-004 in .memory/decisions.md, docs/rbac.md for permission rules.
```

### P0.5 — Audit Log Utility

```
Create a reusable audit logging utility at src/lib/audit.ts.

Requirements:
1. Export createAuditLog(params) that returns a Prisma create operation (not executed — meant to be included in $transaction arrays):
   - params: { action, entityType, entityId, userId, companyId, changes?, metadata? }
   - action: AuditAction enum from Prisma schema (CREATE, UPDATE, DELETE, APPROVE, REJECT, etc.)
   - changes: JSON diff of old vs new values (for UPDATE actions)
   - Never log sensitive field values in changes — log field names only (e.g., "ssnLast4: [REDACTED]")

2. Export buildChanges(oldRecord, newRecord, sensitiveFields?) that:
   - Computes a diff object { field: { old, new } } for changed fields
   - Redacts values for fields in sensitiveFields array

3. Export a higher-order helper withAuditLog(operation, auditParams) that wraps a Prisma mutation + audit log in a single transaction

Follow ADR-002 in .memory/decisions.md: every mutation MUST include an audit log write in the same transaction.
```

### P0.6 — Bull Queue Setup for Background Jobs

```
Set up the Bull job queue infrastructure at src/lib/queue/.

Requirements:
1. Create src/lib/queue/connection.ts:
   - Export a shared Redis connection using ioredis from REDIS_URL env var
   - Handle connection errors gracefully (log and continue — don't crash the app)

2. Create src/lib/queue/queues.ts:
   - Define named queues: emailQueue, payrollQueue, pdfQueue, notificationQueue
   - Each queue uses the shared Redis connection
   - Set default job options: attempts: 3, backoff: { type: 'exponential', delay: 2000 }

3. Create src/lib/queue/workers.ts:
   - Skeleton workers for each queue (process function that logs job data)
   - Workers will be filled in by later prompts

4. Create src/lib/queue/index.ts that re-exports everything

5. Add REDIS_URL to .env.example

Note: Bull v4 is already in package.json. Workers run in the same Next.js process for now (no separate worker process). Follow patterns in .memory/patterns.md.
```

---

## Phase 1: Employee Management (Core Module)

### P1.1 — Employee CRUD API: Create

```
Implement POST /api/employees to create a new employee with full transactional integrity.

Requirements:
1. In src/app/api/employees/route.ts, implement the POST handler:
   - Check session + permission: employee:create
   - Validate body with createEmployeeSchema from src/lib/validations/employee.ts
   - In a single Prisma $transaction:
     a. Create User record (email, hashed password, role, companyId)
     b. Create Employee record linked to User (all profile fields)
     c. Create LeaveBalance records for each active LeaveTypeConfig for the employee's region
     d. Create OnboardingTask records from OnboardingChecklist templates matching employee's employmentType + region
     e. Write AuditLog (action: CREATE, entityType: 'Employee')
   - Encrypt sensitive fields (SSN, Aadhaar, PAN, bank details) using src/lib/encryption.ts before save
   - Return the created employee (without sensitive fields)

2. Send welcome email via emailQueue (not inline — queue the job):
   - Include temporary password or setup link
   - Use React Email template

Reference:
- Prisma schema: prisma/schema.prisma (Employee, User, LeaveBalance, OnboardingTask models)
- Validation: src/lib/validations/employee.ts
- Encryption: src/lib/encryption.ts (from P0.4)
- Audit: src/lib/audit.ts (from P0.5)
- RBAC: src/lib/rbac/middleware.ts — checkPermission()
- API conventions: src/app/api/CLAUDE.md
```

### P1.2 — Employee CRUD API: Update & Delete

```
Implement PATCH and DELETE on /api/employees/[id].

PATCH /api/employees/[id]:
1. Check session + permission: employee:update (or employee:update_own if self)
2. Validate body with updateEmployeeSchema
3. In a Prisma $transaction:
   a. Fetch current employee record
   b. If salary changed, create SalaryHistory entry
   c. Update employee fields
   d. If sensitive fields changed, encrypt new values
   e. Write AuditLog (action: UPDATE) with changes diff (redact sensitive fields)
4. Return updated employee

DELETE /api/employees/[id]:
1. Check session + permission: employee:delete
2. Do NOT hard-delete — set Employee.status to TERMINATED, set terminationDate
3. In a Prisma $transaction:
   a. Update employee status
   b. Deactivate linked User account (set isActive: false)
   c. Write AuditLog (action: DELETE)
4. Return success

Ownership rule: MANAGER role can only update direct reports (where Employee.managerId matches session.employeeId). EMPLOYEE role can only update own non-sensitive fields.

Reference: docs/modules/employees.md, docs/rbac.md
```

### P1.3 — Employee List & Detail Pages: Wire to API

```
Connect the employee list and detail pages to real API data.

1. src/app/(dashboard)/employees/page.tsx:
   - Use the useEmployees() hook from src/hooks/use-employees.ts
   - Wire up search, department filter, status filter, and pagination using nuqs for URL state
   - Show employees in the DataTable component (src/components/ui/data-table.tsx)
   - Columns: Name (with avatar), Email, Department, Designation, Region, Status, Actions
   - "Add Employee" button visible only if can('employee:create')
   - Loading skeleton while data fetches

2. src/app/(dashboard)/employees/[id]/page.tsx:
   - Fetch single employee via GET /api/employees/[id]
   - Show tabs: Profile, Documents, Leave History, Attendance, Salary History
   - Mask sensitive fields unless can('employee:read_sensitive')
   - Edit button visible only if can('employee:update')
   - Show onboarding progress bar if employee.onboardingStatus !== COMPLETED

3. Wire the useEmployees() hook:
   - GET /api/employees with query params: search, department, status, page, limit
   - Use TanStack Query with proper queryKey including all filters
   - Return { data, isLoading, error, pagination }

Use nuqs for all URL state. Use sonner for error toasts. Follow patterns in src/components/CLAUDE.md.
```

### P1.4 — Employee Create/Edit Form Integration

```
Wire the employee create and edit forms to the API.

1. src/app/(dashboard)/employees/new/page.tsx:
   - Multi-step form: Personal Info → Employment Details → Compensation → Documents
   - Use react-hook-form with zodResolver(createEmployeeSchema)
   - On submit, POST to /api/employees via TanStack useMutation
   - Show success toast and redirect to /employees/[id] on success
   - Show validation errors inline on form fields

2. src/app/(dashboard)/employees/[id]/edit/page.tsx:
   - Pre-fill form with existing employee data from GET /api/employees/[id]
   - Use updateEmployeeSchema for validation
   - On submit, PATCH to /api/employees/[id]
   - Only show fields the current user has permission to edit

3. Both forms should:
   - Use Select components for Department, Designation, Region, EmploymentType
   - Fetch department/designation options from API (or hardcode from seed data for now)
   - Handle file upload for profile photo (placeholder — just store URL field)
   - Show/hide India-specific fields (PAN, Aadhaar, PF number) based on region selection
   - Show/hide US-specific fields (SSN) based on region selection

Reference: src/lib/validations/employee.ts for schema, src/components/ui/ for form components.
```

### P1.5 — Department & Designation Management

```
Build CRUD for departments and designations (settings pages).

1. API Routes:
   - POST/GET/PATCH/DELETE /api/departments
   - POST/GET/PATCH/DELETE /api/designations
   - Permission: settings:manage (SUPER_ADMIN, HR_ADMIN only)
   - Include audit logging on all mutations

2. src/app/(dashboard)/settings/departments/page.tsx (new page):
   - DataTable listing all departments
   - Dialog/modal to create/edit a department (name, code, parentDepartmentId, headId, budget)
   - Show employee count per department
   - Tree view or nested list for hierarchy

3. src/app/(dashboard)/settings/designations/page.tsx (new page):
   - DataTable listing all designations
   - Dialog/modal to create/edit (title, level, departmentId)
   - Show associated SalaryBand info per region
   - Inline editing for salary bands (min/mid/max for each region + currency)

Add navigation links to these pages in the Settings sidebar section.
```

### P1.6 — Org Chart Visualization

```
Implement the org chart page at src/app/(dashboard)/org-chart/page.tsx.

Requirements:
1. Fetch all employees with their managerId relationships via GET /api/employees?include=manager
2. Build a tree structure from the flat employee list (root = employees with no managerId)
3. Render an interactive org chart:
   - Each node shows: avatar, name, designation, department
   - Click to expand/collapse subtrees
   - Click a node to navigate to /employees/[id]
   - Support zoom and pan for large orgs
4. Use a simple CSS-based tree layout (flexbox/grid) — no heavy library needed
5. Show department color coding
6. Filter by department dropdown
7. Mobile: switch to a list/accordion view instead of tree

Keep it simple — avoid react-d3-tree or similar heavy dependencies. A clean CSS tree with lines connecting nodes is sufficient.
```

---

## Phase 2: Leave Management

### P2.1 — Leave Request: Submit API

```
Implement POST /api/leave to submit a leave request.

Requirements:
1. Check session + permission: leave:request (all employees can request)
2. Validate body with leaveRequestSchema from src/lib/validations/leave.ts
3. Business logic:
   a. Fetch employee's LeaveBalance for the requested LeaveType + current year
   b. Calculate business days between startDate and endDate:
      - Exclude weekends (Sat/Sun)
      - Exclude company holidays (from Holiday table for employee's region)
      - Use date-fns-tz with employee's timeZone
      - Support half-day (isHalfDay flag → 0.5 days)
   c. Check: balance.entitled - balance.used - balance.pending >= calculated days
      - If insufficient, return 409 with clear error message
   d. In a Prisma $transaction:
      - Create LeaveRequest (status: PENDING)
      - Increment LeaveBalance.pending by calculated days
      - Write AuditLog (action: CREATE, entityType: 'LeaveRequest')
4. Queue notification to the employee's manager (via notificationQueue):
   - In-app notification
   - Email notification

Reference: docs/modules/leave.md, ADR-003 (date-fns-tz), prisma/schema.prisma (LeaveRequest, LeaveBalance, Holiday models)
```

### P2.2 — Leave Request: Approve/Reject API

```
Implement PATCH /api/leave/[id] for approving or rejecting leave requests.

Requirements:
1. Check session + permission: leave:approve_team (MANAGER) or leave:approve_all (HR+)
2. Accept body: { status: 'APPROVED' | 'REJECTED', rejectionReason?: string }
3. Ownership check for MANAGER role: the leave request's employee.managerId must equal session.employeeId
4. Business logic:
   a. Fetch the LeaveRequest with employee's LeaveBalance
   b. If current status is not PENDING, return 409 ("Already processed")
   c. In a Prisma $transaction:
      - Update LeaveRequest status, set approvedById, approvedAt (or rejectionReason)
      - If APPROVED: move days from balance.pending to balance.used
      - If REJECTED: subtract days from balance.pending
      - Write AuditLog
5. Queue notifications:
   - Notify the requesting employee (approved/rejected)
   - If approved, notify team calendar subscribers

Reference: docs/modules/leave.md, docs/rbac.md (ownership rules)
```

### P2.3 — Leave Balance & History API

```
Implement GET /api/leave/balance to retrieve leave balances.

Requirements:
1. GET /api/leave/balance?employeeId=<id>&year=<year>
   - If no employeeId, return own balances (from session.employeeId)
   - If employeeId provided, check permission: leave:read_team (MANAGER for direct reports) or leave:read_all (HR+)
2. Return all LeaveBalance entries for the employee + year, joined with LeaveTypeConfig for display names
3. Calculate and return derived fields:
   - available = entitled + carried - used - pending
   - utilizationPercent = used / entitled * 100

Also implement GET /api/leave?employeeId=<id>&status=<status>&year=<year>:
- Already partially implemented — enhance with:
  - Filter by status (PENDING, APPROVED, REJECTED, CANCELLED)
  - Filter by year
  - Pagination via nuqs params
  - Include leave type display name
  - Sort by startDate desc
```

### P2.4 — Leave UI Pages: Wire to API

```
Connect all leave management pages to real API data.

1. src/app/(dashboard)/leave/page.tsx (Leave Requests):
   - Fetch leave requests using useLeave() hook
   - DataTable: Employee Name, Leave Type, Start Date, End Date, Days, Status, Actions
   - For MANAGER: show team's requests with Approve/Reject buttons
   - For HR+: show all requests with filters (department, status, type)
   - For EMPLOYEE: show own requests only
   - Pending requests highlighted

2. src/app/(dashboard)/leave/apply/page.tsx (Apply for Leave):
   - Form: Leave Type (dropdown from LeaveTypeConfig), Start Date, End Date, Is Half Day, Reason
   - Show real-time day calculation as dates are selected
   - Show current balance for selected leave type
   - Warn if requesting more than available
   - On submit, POST /api/leave
   - Redirect to /leave on success

3. src/app/(dashboard)/leave/calendar/page.tsx (Team Calendar):
   - Monthly calendar view showing approved leaves
   - Color-coded by leave type
   - Filter by department
   - Show holidays as background markers

4. src/app/(dashboard)/leave/policies/page.tsx (Leave Policies):
   - Read-only table of LeaveTypeConfig for the company
   - Show: type, days entitled, carry-forward policy, applicable regions
   - HR+ sees an "Edit" button to modify policies (future enhancement)

Use nuqs for all filters/pagination. Use TanStack Query for data fetching. Use sonner for toasts.
```

---

## Phase 3: Attendance

### P3.1 — Attendance: Clock In/Out API

```
Implement the clock in/out API at /api/attendance/clock.

POST /api/attendance/clock:
1. Check session (any authenticated employee can clock in/out)
2. Accept body: { action: 'CLOCK_IN' | 'CLOCK_OUT', notes?: string }
3. Business logic:
   a. Get current date in employee's timezone (date-fns-tz)
   b. For CLOCK_IN:
      - Check no existing attendance record for today with clockIn but no clockOut
      - Create Attendance record with clockIn = now, status = PRESENT
      - If clockIn is after shift start + 15 min grace, set status = LATE
   c. For CLOCK_OUT:
      - Find today's open attendance record (clockIn exists, clockOut is null)
      - If none found, return 409 ("Not clocked in")
      - Set clockOut = now
      - Calculate totalHours = diff(clockOut, clockIn) in hours
      - Calculate overtimeHours = max(0, totalHours - 8)
      - Set isOvertime flag if overtimeHours > 0
4. Prisma $transaction with AuditLog
5. Return the attendance record

GET /api/attendance:
- Already partially implemented — enhance with:
  - Filter by date range, employeeId, status
  - MANAGER sees team, HR+ sees all, EMPLOYEE sees own
  - Include pagination

Reference: docs/modules/attendance.md, prisma/schema.prisma (Attendance model, AttendanceStatus enum)
```

### P3.2 — Attendance UI: Clock & Reports

```
Wire the attendance pages to real data.

1. src/app/(dashboard)/attendance/page.tsx:
   - Big clock-in/clock-out button at top (shows current state)
   - Today's status: "Clocked in at 9:15 AM" or "Not clocked in"
   - Weekly summary: table showing each day's clock in, clock out, hours, status
   - Use the useAttendance() hook to fetch data

2. src/app/(dashboard)/attendance/reports/page.tsx:
   - For MANAGER/HR+: team attendance report
   - DataTable: Employee, Date, Clock In, Clock Out, Hours, Status, Late
   - Filters: date range (nuqs), department, employee search
   - Summary stats at top: avg hours, late count, absent count, overtime count
   - Export to CSV button (client-side CSV generation from table data)

3. Update useAttendance() hook in src/hooks/use-attendance.ts:
   - getTodayAttendance() — for clock-in/out widget
   - getAttendanceList(filters) — for reports
   - clockIn() / clockOut() — mutations

Keep the clock-in/out button prominent and obvious. Show clear visual feedback on state changes.
```

---

## Phase 4: Payroll

### P4.1 — Payroll Calculation Engine

```
Build the payroll calculation engine at src/lib/payroll/calculator.ts.

Requirements:
1. Export calculatePayslip(employee, month, year):
   - Input: Employee record with salary, region, compliance details
   - Output: PayslipBreakdown object

2. For INDIA region:
   - Basic salary = annual CTC / 12
   - HRA = basic * 0.4 (metro) or basic * 0.5 (non-metro) — configurable
   - Special allowance = gross - basic - HRA
   - Deductions:
     - PF: use src/lib/compliance/india/pf.ts calculatePF()
     - ESI: 0.75% of gross if gross <= 21000
     - Professional Tax: state-based (use 200/month for NJ equivalent — or actual state rule)
     - TDS: use src/lib/compliance/india/tds.ts
   - Net pay = gross - all deductions

3. For US region:
   - Gross = annual salary / 12
   - Deductions:
     - Federal tax: simplified bracket calculation (or placeholder percentage)
     - State tax (NJ): simplified bracket
     - Social Security: 6.2% up to wage base
     - Medicare: 1.45%
     - 401k: employee contribution percentage
   - Net pay = gross - all deductions

4. Return typed PayslipBreakdown matching the Payslip model fields:
   { basicSalary, hra, specialAllowance, otherAllowances, grossEarnings, pfDeduction, esiDeduction, tdsDeduction, professionalTax, otherDeductions, totalDeductions, netPay }

Reference: docs/modules/payroll.md, docs/compliance-india.md, docs/compliance-us.md
```

### P4.2 — Payroll Run API

```
Implement the payroll run endpoints.

POST /api/payroll/run (Create a payroll run):
1. Permission: payroll:run (SUPER_ADMIN, HR_ADMIN, FINANCE)
2. Accept: { month, year, region }
3. Business logic:
   a. Check no existing run for this month/year/region in DRAFT or PROCESSING status
   b. Fetch all active employees for the region
   c. Create PayrollRun (status: DRAFT)
   d. For each employee, calculate payslip using the calculator (P4.1)
   e. Batch-create Payslip records linked to the run
   f. AuditLog in transaction
4. Return the PayrollRun with summary (total employees, total gross, total net)

PATCH /api/payroll/run (Update status):
1. Accept: { runId, action: 'PROCESS' | 'APPROVE' | 'REJECT' | 'PAY' }
2. State machine: DRAFT → PROCESSING → PENDING_APPROVAL → APPROVED → PAID (or REJECTED at any stage)
3. APPROVE requires payroll:approve (SUPER_ADMIN only)
4. When status → PAID:
   - Queue payslip PDF generation for each employee (pdfQueue)
   - Queue payslip email to each employee (emailQueue)
5. AuditLog for each status change

GET /api/payroll/run?month=&year=&region=&status=:
- List runs with filters
- Include summary stats per run

GET /api/payroll/run/[id]:
- Return run details with all payslips
- Include employee names and breakdown

Reference: docs/modules/payroll.md, prisma/schema.prisma (PayrollRun, Payslip, PayrollStatus enum)
```

### P4.3 — Payslip PDF Generation

```
Implement payslip PDF generation using pdfmake.

1. Create src/lib/pdf/payslip.ts:
   - Export generatePayslipPDF(payslip, employee, company): Buffer
   - Layout:
     - Company header (name, logo URL, address)
     - Employee details (name, ID, department, designation, bank masked)
     - Pay period (month/year)
     - Earnings table (Basic, HRA, Special Allowance, Other)
     - Deductions table (PF, ESI, TDS, Professional Tax, Other)
     - Net Pay (highlighted)
     - Footer: "This is a computer-generated document"
   - Use pdfmake (already in package.json)

2. Create the PDF queue worker in src/lib/queue/workers.ts:
   - payslipPdfWorker processes jobs from pdfQueue
   - Job data: { payslipId }
   - Fetch payslip + employee + company
   - Generate PDF buffer
   - Upload to UploadThing (or save to local /tmp for now)
   - Update Payslip.pdfUrl in database
   - Queue email to employee with PDF attached

3. Add "Download Payslip" link on payslip detail view that serves the PDF.

Reference: docs/modules/payroll.md
```

### P4.4 — Payroll UI Pages

```
Wire payroll pages to API data.

1. src/app/(dashboard)/payroll/page.tsx (Payroll Dashboard):
   - Summary cards: Current month status, total payroll amount, pending approvals
   - Recent payroll runs table: Month, Region, Status, Employee Count, Total Net, Actions
   - "New Payroll Run" button (visible if can('payroll:run'))

2. src/app/(dashboard)/payroll/run/page.tsx (Create/View Run):
   - If creating: form with Month, Year, Region selectors → POST /api/payroll/run
   - If viewing (with runId query param): show run details with all payslips
   - Payslip table: Employee, Basic, Gross, Deductions, Net, Status
   - Action buttons based on run status: Process, Approve, Mark as Paid
   - Approval requires confirmation dialog

3. src/app/(dashboard)/payroll/history/page.tsx:
   - Historical payroll runs list
   - Filters: year, region, status (nuqs)
   - Click to view run details
   - Export run summary to CSV

4. Employee self-service (on employee detail /employees/[id]):
   - "Payslips" tab showing own payslip history
   - Download PDF button per payslip

Permission-gate all actions. Use sonner for toast feedback.
```

---

## Phase 5: Performance Reviews

### P5.1 — Review Cycle CRUD API

```
Implement performance review cycle management APIs.

POST /api/performance/cycles:
1. Permission: performance:manage_cycles (HR_ADMIN+)
2. Accept: { name, type (QUARTERLY/ANNUAL/PROBATION), startDate, endDate, selfReviewDeadline, peerReviewDeadline, managerReviewDeadline }
3. Create ReviewCycle (status: DRAFT)
4. AuditLog

PATCH /api/performance/cycles/[id]:
1. Permission: performance:manage_cycles
2. Accept status changes: DRAFT → ACTIVE → COMPLETED
3. When ACTIVE:
   - Auto-create PerformanceReview records for all active employees
   - Each review starts as NOT_STARTED
   - Queue notification to all employees that the review cycle has started
4. AuditLog

GET /api/performance/cycles:
- List all cycles with filters (status, type, year)
- Include summary: total reviews, completed count, pending count

GET /api/performance/cycles/[id]:
- Cycle details with all reviews
- Progress breakdown by department

Reference: docs/modules/performance.md, prisma/schema.prisma (ReviewCycle, PerformanceReview, ReviewStatus enum)
```

### P5.2 — Performance Review Submission API

```
Implement review submission and progression APIs.

PATCH /api/performance/reviews/[id]:
1. Handle different stages:

   a. SELF_REVIEW submission (by the employee being reviewed):
      - Accept: { selfRating: 1-5, selfComments }
      - Advance status to PEER_REVIEW
      - Notify assigned peer reviewers

   b. PEER_REVIEW submission (by assigned peers):
      - Accept: { peerRating, peerComments }
      - Store as JSON in peerFeedback field
      - When all peers submitted, advance to MANAGER_REVIEW
      - Notify employee's manager

   c. MANAGER_REVIEW submission (by employee's manager):
      - Accept: { managerRating, managerComments, goals for next period }
      - Ownership check: session.employeeId === employee.managerId
      - Advance to HR_REVIEW
      - Trigger AI summary generation (queue job)

   d. HR_REVIEW (by HR):
      - Accept: { finalRating, hrComments, promotionRecommendation? }
      - Advance to COMPLETED
      - Notify employee that review is complete

2. AI Summary generation (via Claude API):
   - When manager submits, queue a job to call src/lib/ai/client.ts
   - Prompt: combine self + peer + manager feedback → generate a balanced summary
   - Store in review.aiSummary field
   - Use prompts from src/lib/ai/prompts.ts

3. AuditLog every status change. Permission checks per role at each stage.

Reference: docs/modules/performance.md
```

### P5.3 — Goals & OKR Tracking API

```
Implement goal/OKR management APIs.

POST /api/performance/goals:
1. Permission: any employee can create own goals; MANAGER can create for reports
2. Accept: { title, description, type (INDIVIDUAL/TEAM/COMPANY), targetDate, keyResults[] }
3. keyResults: array of { title, targetValue, unit }
4. Create Goal + linked KeyResult records
5. AuditLog

PATCH /api/performance/goals/[id]:
1. Update goal progress:
   - Accept: { status, keyResults: [{ id, currentValue }] }
   - Recalculate goal progress as average of keyResults completion percentages
   - Status transitions: NOT_STARTED → IN_PROGRESS → COMPLETED/CANCELLED
2. AuditLog

GET /api/performance/goals:
- Filter by employeeId, status, type, reviewCycleId
- EMPLOYEE sees own, MANAGER sees team's, HR+ sees all
- Include keyResults with completion %

Reference: docs/modules/performance.md, prisma/schema.prisma (Goal, GoalStatus enum)
```

### P5.4 — Performance UI Pages

```
Wire performance pages to API data.

1. src/app/(dashboard)/performance/page.tsx (Cycles List):
   - Active cycles at top with progress bars
   - Historical cycles below
   - "Create Cycle" button for HR_ADMIN+

2. src/app/(dashboard)/performance/[cycleId]/page.tsx (Cycle Detail):
   - Overview stats: total reviews, by status breakdown
   - Reviews table: Employee, Department, Status, Self Rating, Manager Rating, Final Rating
   - Filter by department, status
   - Click to view individual review

3. src/app/(dashboard)/performance/reviews/page.tsx (My Reviews):
   - Show current user's pending reviews (self-review, peer reviews to complete)
   - Review form with rating (1-5 stars/scale) + comments textarea
   - Submit button advances to next stage
   - Show AI summary when available (read-only for employee)

4. src/app/(dashboard)/performance/goals/page.tsx (Goals):
   - My Goals section: list with progress bars
   - Team Goals (for managers): direct reports' goals
   - Create goal dialog/modal
   - Update progress inline (slider or number input for key results)

Use proper loading states and permission gating throughout.
```

---

## Phase 6: Recruitment

### P6.1 — Job Posting CRUD API

```
Implement job posting management APIs.

POST /api/recruitment/jobs:
1. Permission: recruitment:manage_jobs (RECRUITER, HR+)
2. Accept: { title, description, departmentId, designationId, employmentType, location, region, salaryMin, salaryMax, currency, requirements, hiringManagerId }
3. Create Job (status: DRAFT)
4. AuditLog

PATCH /api/recruitment/jobs/[id]:
1. Update job details or status
2. Status transitions: DRAFT → PUBLISHED → ON_HOLD → CLOSED → FILLED
3. When PUBLISHED, set publishedAt timestamp
4. AuditLog

GET /api/recruitment/jobs:
- List with filters: status, department, region
- Include candidate count per job
- Include hiring manager name

GET /api/recruitment/jobs/[id]:
- Job details with candidates in pipeline

Reference: docs/modules/recruitment.md, prisma/schema.prisma (Job, JobStatus enum)
```

### P6.2 — Candidate Pipeline API

```
Implement candidate management and pipeline APIs.

POST /api/recruitment/candidates:
1. Permission: recruitment:manage_candidates
2. Accept: { jobId, firstName, lastName, email, phone, resumeUrl, source, referredById? }
3. Create Candidate (stage: APPLIED)
4. Queue AI assessment job if resume provided
5. AuditLog

PATCH /api/recruitment/candidates/[id]:
1. Move through pipeline stages:
   - APPLIED → SCREENING → INTERVIEWING → OFFERED → HIRED (or REJECTED at any stage)
2. Accept: { stage, notes, interviewScore?, rejectionReason? }
3. When OFFERED: trigger offer letter generation (future)
4. When HIRED: trigger employee creation workflow (link to P1.1)
5. AuditLog + notification to hiring manager

GET /api/recruitment/candidates:
- Filter by jobId, stage, source
- Include AI assessment score if available
- Pagination

AI Candidate Assessment (background job):
- When candidate is created with resumeUrl, queue assessment job
- Use Claude API with candidate assessment prompt from src/lib/ai/prompts.ts
- Parse resume text, evaluate against job requirements
- Store aiAssessment (text summary) and aiScore (1-100) on Candidate record

Reference: docs/modules/recruitment.md
```

### P6.3 — Recruitment UI Pages

```
Wire recruitment pages to API data.

1. src/app/(dashboard)/recruitment/page.tsx (Dashboard):
   - Summary cards: Open Positions, Active Candidates, Hires This Month, Time to Fill
   - Recent activity feed

2. src/app/(dashboard)/recruitment/jobs/page.tsx:
   - Job listings table: Title, Department, Status, Candidates, Posted Date, Actions
   - Create job dialog/form
   - Click to view job detail + candidates

3. src/app/(dashboard)/recruitment/candidates/page.tsx:
   - Candidates table: Name, Job, Stage, Source, AI Score, Applied Date, Actions
   - Filter by job, stage, source
   - Click to view candidate detail

4. src/app/(dashboard)/recruitment/pipeline/page.tsx:
   - Kanban board view of candidates by stage
   - Columns: Applied → Screening → Interviewing → Offered → Hired
   - Drag-and-drop to move between stages (or dropdown on mobile)
   - Click card to see candidate details + AI assessment
   - Filter by job posting

Keep the Kanban simple — CSS grid with drag handled by HTML5 drag-and-drop API (no heavy DnD library needed).
```

---

## Phase 7: Documents & Notifications

### P7.1 — Document Upload & Management API

```
Implement document management APIs with UploadThing integration.

1. Wire up UploadThing:
   - Configure file router at src/app/api/upload/route.ts
   - Accept: images (5MB), documents/PDFs (10MB)
   - Associate uploads with employeeId and documentCategory

2. POST /api/documents:
   - Permission: documents:upload (employee for own, HR+ for any)
   - Accept: { employeeId, category, title, fileUrl (from UploadThing), expiryDate? }
   - Create EmployeeDocument record
   - AuditLog

3. GET /api/documents:
   - Filter by employeeId, category
   - EMPLOYEE sees own, MANAGER sees team's, HR+ sees all
   - Include expiry warning flag (within 30 days of expiry)

4. DELETE /api/documents/[id]:
   - Soft delete (set isActive: false) — don't delete from storage
   - AuditLog

5. Document template rendering:
   - GET /api/documents/templates — list available templates
   - POST /api/documents/templates/render — accept { templateId, variables } → return populated HTML
   - Templates: OFFER_LETTER, NDA, HANDBOOK, EXPERIENCE_LETTER
   - Store templates as Handlebars-style strings in DocumentTemplate table
   - Replace variables: {{employeeName}}, {{designation}}, {{startDate}}, {{salary}}, etc.

Reference: docs/modules/documents.md
```

### P7.2 — Notification System

```
Build the notification delivery system.

1. POST /api/notifications (internal — called by other services, not directly by users):
   - Create Notification record (type, title, message, employeeId, link?)
   - If employee has email notifications enabled, queue email via emailQueue

2. GET /api/notifications:
   - Return current user's notifications, newest first
   - Include unread count
   - Pagination

3. PATCH /api/notifications/[id]:
   - Mark as read (set readAt = now)
   - Mark all as read (batch endpoint: PATCH /api/notifications?markAllRead=true)

4. Create notification helper at src/lib/notifications/send.ts:
   - Export notify({ employeeId, type, title, message, link? })
   - Creates DB record + queues email
   - Used by all other modules (leave approval, payroll ready, review due, etc.)

5. Wire the notification bell in src/components/layout/topbar.tsx:
   - Show unread count badge
   - Dropdown panel with recent notifications
   - Click notification → navigate to link
   - "Mark all read" button
   - Use useNotifications() hook with polling (every 30 seconds) or optimistic updates

6. Email workers (src/lib/queue/workers.ts):
   - emailWorker processes emailQueue jobs
   - Job data: { to, subject, templateName, templateData }
   - Use src/lib/email/sender.ts to send via Resend
   - Create basic email templates:
     - leave-approved.tsx
     - leave-rejected.tsx
     - review-due.tsx
     - payslip-ready.tsx
     - welcome.tsx

Reference: docs/modules/notifications.md
```

---

## Phase 8: Dashboard & Reports

### P8.1 — Dashboard: Wire to Real Data

```
Replace hardcoded demo data on the dashboard with real API data.

1. Create GET /api/dashboard/stats:
   - Permission: dashboard:view (all authenticated users)
   - Return role-appropriate stats:
     - EMPLOYEE: own leave balance, attendance today, pending reviews, upcoming holidays
     - MANAGER: team headcount, pending leave approvals, team attendance today, active reviews
     - HR+: total employees, open positions, pending payroll, leave requests pending, turnover rate
     - FINANCE: current month payroll total, pending payroll runs, YTD payroll
   - Calculate trends (vs last month) for each stat

2. Create GET /api/dashboard/charts:
   - headcountByDepartment: { department, count }[]
   - attendanceTrend: { date, present, absent, wfh }[] (last 30 days)
   - leaveUtilization: { leaveType, used, total }[]
   - hiringPipeline: { stage, count }[]

3. Update src/app/(dashboard)/page.tsx:
   - Replace hardcoded stats with API data via TanStack Query
   - Show role-appropriate stat cards (use usePermission() to determine what to show)
   - Wire charts to real data
   - Add quick actions panel: Clock In, Apply Leave, View Payslip, etc.
   - Show upcoming: birthdays, work anniversaries, holidays (next 7 days)

Reference: docs/architecture.md for module map
```

### P8.2 — Reports Module

```
Implement the dynamic reports system.

1. Create report generator at src/lib/reports/generator.ts:
   - Export generateReport(type, filters): { data, columns, summary }
   - Report types:
     - HEADCOUNT: employee count by department, designation, region, status
     - ATTENDANCE: attendance summary by employee/department for date range
     - LEAVE: leave utilization by type, department, employee for period
     - PAYROLL: payroll summary by month, region, department
     - TURNOVER: joins/exits by month, department, reason
     - COMPLIANCE: pending compliance items (expired docs, missing I-9s, PF registration)

2. GET /api/reports/[type]:
   - Permission: reports:view (MANAGER for team, HR+/FINANCE for all)
   - Accept filters as query params: dateFrom, dateTo, department, region
   - Call generateReport() and return data

3. Wire src/app/(dashboard)/reports/[type]/page.tsx:
   - Dynamic page that renders based on report type
   - Filter bar at top (date range, department, region)
   - DataTable for the report data
   - Summary cards above the table
   - Export buttons: CSV (client-side), PDF (via pdfQueue)

4. src/app/(dashboard)/reports/page.tsx (Reports Index):
   - Grid of report cards: Headcount, Attendance, Leave, Payroll, Turnover, Compliance
   - Each card shows a brief description + icon
   - Click to navigate to /reports/[type]
   - Only show reports the user has permission to view
```

---

## Phase 9: Settings & Company Config

### P9.1 — Company Settings Page

```
Wire the company settings page to manage company configuration.

1. GET/PATCH /api/settings/company:
   - Permission: settings:manage (SUPER_ADMIN, HR_ADMIN)
   - Return/update: company name, logo, address, regions, fiscalYearStart, timezone, workWeek config

2. src/app/(dashboard)/settings/company/page.tsx:
   - Form with company details
   - Logo upload (via UploadThing)
   - Work week configuration (which days are working days)
   - Fiscal year start month
   - Default timezone

3. Compliance settings at src/app/(dashboard)/settings/compliance/page.tsx:
   - Toggle compliance modules per region:
     - India: PF registration, ESI, Professional Tax, TDS
     - US: FMLA, NJ Sick Leave, EEO-1 reporting
   - Set PF/ESI rates (if they differ from statutory defaults)
   - Configure tax brackets (or use statutory defaults)

4. Leave policy management (link from settings):
   - CRUD for LeaveTypeConfig
   - Set entitlements per leave type per region
   - Set carry-forward rules (max days, expiry)
   - Set approval workflow (auto-approve for < N days?)
```

### P9.2 — Role Management & Audit Log Viewer

```
Build the role management and audit log viewer.

1. src/app/(dashboard)/settings/roles/page.tsx:
   - Display current role assignments (read from User records)
   - DataTable: User, Email, Current Role, Last Login
   - Change role via dropdown (SUPER_ADMIN only)
   - PATCH /api/users/[id]/role — update role with audit log
   - Cannot demote own role or the last SUPER_ADMIN

2. Audit Log Viewer:
   - Create src/app/(dashboard)/settings/audit-log/page.tsx
   - GET /api/audit-log — paginated, filterable
   - Filters: action type, entity type, user, date range
   - DataTable: Timestamp, User, Action, Entity Type, Entity ID, Changes (expandable JSON)
   - Permission: audit:view (SUPER_ADMIN, HR_ADMIN)
   - Export to CSV

3. Add navigation links in settings sidebar for both pages.
```

---

## Phase 10: AI Assistant

### P10.1 — AI HR Assistant

```
Implement the AI HR assistant at src/app/(dashboard)/ai-assistant/page.tsx.

1. Complete the API at /api/ai/assistant:
   - Permission: ai:assistant (SUPER_ADMIN, HR_ADMIN, HR_MANAGER, MANAGER)
   - Accept: { messages: [{ role, content }] } (chat format)
   - Use src/lib/ai/client.ts to call Claude API
   - System prompt from src/lib/ai/prompts.ts — includes:
     - Company context (name, regions, policies)
     - User's role and permissions
     - Available actions the AI can help with
   - Support tool use / function calling for:
     - Look up employee info (query Prisma)
     - Check leave balances
     - Summarize attendance
     - Draft emails
   - Stream the response using ReadableStream

2. Build the chat UI:
   - Message list with user/assistant bubbles
   - Text input with send button
   - Streaming response display
   - Suggested prompts: "Who's on leave today?", "Summarize Q1 attendance for Engineering", "Draft a performance improvement plan for..."
   - Message history (store in state, not persisted)

3. Guard data access:
   - The AI should only return data the current user has permission to see
   - Pass the user's role/permissions to the system prompt
   - Never return sensitive fields (SSN, bank details) through the AI

Reference: src/lib/ai/prompts.ts, src/lib/ai/client.ts, docs/architecture.md
```

---

## Phase 11: Polish & Production Readiness

### P11.1 — Error Boundaries & Loading States

```
Add proper error handling and loading states across the app.

1. Create src/app/error.tsx (root error boundary):
   - Friendly error page with "Try Again" button
   - Log error to console (or external service)

2. Create src/app/(dashboard)/error.tsx (dashboard error boundary):
   - Keep sidebar visible, show error in content area
   - "Go to Dashboard" and "Try Again" buttons

3. Create src/app/loading.tsx and src/app/(dashboard)/loading.tsx:
   - Skeleton loading states matching page layouts
   - Use src/components/ui/skeleton.tsx

4. Add error boundaries to each major page:
   - Wrap data-fetching sections in Suspense with skeleton fallbacks
   - Handle TanStack Query errors with retry + error display

5. Create src/components/ui/error-state.tsx:
   - Reusable error display component (icon, message, retry button)
   - Variants: network error, permission denied, not found, generic

6. 404 page: src/app/not-found.tsx
   - Friendly "Page not found" with navigation back
```

### P11.2 — Mobile Responsiveness Pass

```
Ensure all pages work well on mobile (375px-768px).

Review and fix each page:
1. DataTable components: horizontal scroll on mobile, or switch to card view
2. Forms: single column layout on mobile
3. Dashboard: stack stat cards vertically
4. Sidebar: already has mobile drawer — verify it works
5. Calendar views: simplified mobile layout
6. Kanban board (recruitment): switch to list view on mobile
7. Charts: responsive sizing
8. Dialogs/modals: full-screen on mobile
9. Bottom nav: verify all key pages are accessible

Use Tailwind responsive prefixes (sm:, md:, lg:). Test at 375px, 768px, 1024px breakpoints.
No new dependencies — Tailwind only.
```

### P11.3 — Cron Jobs: Automated Notifications

```
Set up scheduled notification jobs.

Create src/lib/queue/cron.ts:
1. Birthday reminder (daily at 8 AM):
   - Query employees with dateOfBirth matching today
   - Send notification to HR + team manager
   - Send birthday wish email to employee

2. Work anniversary reminder (daily at 8 AM):
   - Query employees with startDate anniversary today
   - Notify HR + team

3. Probation ending reminder (daily):
   - Query employees where probationEndDate is within 7 days
   - Notify HR + manager to schedule review

4. Leave balance expiry warning (monthly):
   - Query employees with carry-forward leave expiring next month
   - Notify employees to use or lose

5. Document expiry warning (daily):
   - Query EmployeeDocuments with expiryDate within 30 days
   - Notify employee + HR

6. Attendance missing (daily at 7 PM):
   - Query employees who didn't clock in today (and aren't on leave)
   - Notify the employee

Implementation:
- Use Bull's repeat/cron option for scheduling
- Each job runs as a Bull worker
- Log all cron executions for debugging
- Handle timezone-aware scheduling (run at 8 AM in each region's timezone)
```

### P11.4 — Security Hardening

```
Security review and hardening pass.

1. API rate limiting:
   - Add rate limiter middleware (in-memory for dev, Redis for prod)
   - /api/auth/* — 5 requests/minute per IP
   - /api/* — 100 requests/minute per user
   - /api/ai/* — 10 requests/minute per user

2. Input sanitization:
   - Verify all API routes use Zod validation (no unvalidated inputs)
   - Sanitize HTML in text fields (DOMPurify or similar)
   - Verify no raw SQL anywhere (Prisma only)

3. CORS & headers:
   - Set appropriate CORS headers in next.config.ts
   - Add security headers: X-Frame-Options, X-Content-Type-Options, CSP

4. Session security:
   - Verify JWT expiry is set (24 hours)
   - Add session rotation on privilege change (role update)
   - Ensure httpOnly + secure + sameSite on cookies

5. Sensitive data:
   - Verify encryption module is used for all PII fields
   - Verify sensitive fields are excluded from API responses by default
   - Verify AuditLog never contains plaintext PII

6. File upload security:
   - Validate file types server-side (not just client)
   - Set max file sizes
   - Scan for malicious content (basic checks)
```

---

## Quick Reference: Prompt Dependencies

```
P0.1 (DB Migration) → everything else
P0.2 (Login) → all authenticated features
P0.3 (Forgot Password) → standalone after P0.1
P0.4 (Encryption) → P1.1 (Employee Create)
P0.5 (Audit Log) → all mutation APIs
P0.6 (Bull Queue) → P4.3, P7.2, P11.3

P1.1-P1.6 → can start after P0.*
P2.* → can start after P1.1 (needs employees)
P3.* → can start after P1.1
P4.* → can start after P1.1 + P0.6
P5.* → can start after P1.1
P6.* → can start after P1.1
P7.* → can start after P0.6
P8.* → after all module APIs exist
P9.* → can start after P0.1
P10.* → can start after P1.1
P11.* → after core modules complete
```
