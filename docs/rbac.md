# RBAC Reference

## Role Hierarchy
SUPER_ADMIN > HR_ADMIN > HR_MANAGER > MANAGER > EMPLOYEE
FINANCE and RECRUITER are lateral roles with specific scope.
VIEWER = read-only.

## Ownership Rules
- Managers can approve/view their direct reports only
- Employees can view/update their own records
- Finance sees payroll data only

## Enforcement Points
1. Middleware: protects route groups
2. API route handlers: checkPermission(session, permission)
3. UI: PermissionGate component wrapper
4. Prisma queries: where clauses enforce ownership scoping
