# Queue Context

## Structure
- `connection.ts` — Redis singleton via ioredis (REDIS_URL env var)
- `queues.ts` — Bull queue factory + typed queue instances (email, payroll, pdf, notification)
- `cron.ts` — Repeatable cron jobs (birthday, anniversary, probation, doc-expiry, leave-balance)
- `workers.ts` — All queue processors registered here (import on worker startup)
- `index.ts` — Barrel exports for external consumers

## Conventions
- All queues created via `createQueue<T>(name)` in `queues.ts`
- The `cronQueue` is created directly in `cron.ts` (separate concern from request-driven queues)
- Workers use `queue.process(async (job) => ...)` pattern
- Error handling: per-job try/catch in processors; queue-level `on('failed')` for logging
- Cron jobs use Bull's `repeat: { cron }` option with UTC expressions
- `registerCronJobs()` is idempotent — safe to call on every worker restart
- Stale repeatable jobs are cleaned up automatically during registration

## Cron Schedule (UTC / ET)
| Job | UTC Cron | ET Time | Frequency |
|-----|----------|---------|-----------|
| birthday-reminder | `0 13 * * *` | 08:00 | Daily |
| work-anniversary-reminder | `0 13 * * *` | 08:00 | Daily |
| probation-ending-reminder | `0 14 * * *` | 09:00 | Daily |
| document-expiry-warning | `0 15 * * *` | 10:00 | Daily |
| leave-balance-expiry-warning | `0 14 1 * *` | 09:00 | Monthly (1st) |

## Adding a New Cron Job
1. Add the job type to `CronJobData['jobType']` union in `cron.ts`
2. Create a `processXxx()` function following the existing pattern
3. Add a case to `processCronJob()` switch
4. Add a schedule entry to `CRON_SCHEDULES` array
5. The job will auto-register on next worker restart
