# GliscoHR — Root Agent Memory

## Project
Enterprise HR platform for Glisco Lab (NYC/NJ agency).
Next.js 15 App Router · TypeScript · Prisma/PostgreSQL · NextAuth v5 · Tailwind CSS

## Stack
- **Runtime**: Next.js 15 (App Router, RSC-first)
- **DB**: PostgreSQL via Prisma ORM
- **Auth**: NextAuth v5 + Prisma adapter
- **State**: TanStack Query (server state) + Zustand (UI state)
- **Email**: Resend + React Email templates
- **Files**: UploadThing
- **AI**: Anthropic Claude API
- **Queue**: Bull + Redis (background jobs)
- **Validation**: Zod (shared client/server schemas)

## Critical Rules
1. RBAC middleware runs on every /api/* route — never skip it
2. All mutations must write to AuditLog table atomically (Prisma transactions)
3. Multi-region compliance: US (NJ labor law) + India (PF/Gratuity/TDS)
4. No raw SQL — Prisma only; migrations reviewed before apply
5. Environment secrets: .env.local only, never committed
6. Use nuqs for all URL state (filters, pagination, search)
7. sonner for all toast notifications — not custom toast
8. All date math uses date-fns-tz with explicit timezone

## Agent Memory System

### Before Working
- Read this file + target directory's CLAUDE.md
- Check .memory/decisions.md before any architectural change
- Check .memory/patterns.md before implementing shared functionality

### During Work
- Create CLAUDE.md in any new directory you create
- Use Prisma transactions for any write touching >1 table

### After Work
- Update CLAUDE.md if conventions changed
- Log ADRs → .memory/decisions.md
- Log patterns → .memory/patterns.md
- Inferences → .memory/inbox.md

### Safety
- Never record secrets or PII in memory files
- Never overwrite ADRs — mark [superseded]
