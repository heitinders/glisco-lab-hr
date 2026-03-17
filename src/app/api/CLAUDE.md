# API Routes Context

## Pattern (EVERY route must follow this order):
1. Auth check via getServerSession
2. RBAC via checkPermission()
3. Request validation via Zod schema
4. DB operation wrapped in $transaction with AuditLog
5. Email/notification trigger (async, via queue)
6. Return typed JSON

## Never:
- Skip RBAC on any route
- Return raw Prisma errors to client
- Log PII to console

## Error Codes:
401 = Unauthenticated
403 = Unauthorized (RBAC)
422 = Validation failed
409 = Conflict (duplicate)
500 = Internal (generic message to client, full error to server logs)
