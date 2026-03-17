# GliscoHR Architecture

## Overview
Monorepo, single Next.js app. Deployed on Vercel + managed PostgreSQL (Railway/Neon).

## Data Flow
Browser → Next.js Route Handler → RBAC check → Zod validation → Prisma → PostgreSQL

## Module Map
| Module | Routes | Key Models |
|---|---|---|
| Employees | /employees | Employee, Department, Designation |
| Leave | /leave | LeaveRequest, LeaveBalance, LeaveTypeConfig |
| Attendance | /attendance | Attendance |
| Payroll | /payroll | PayrollRun, Payslip, SalaryHistory |
| Performance | /performance | ReviewCycle, PerformanceReview, Goal |
| Recruitment | /recruitment | Job, Candidate |
| Documents | /documents | EmployeeDocument, DocumentTemplate |

## Auth Flow
NextAuth v5 → credentials or Google SSO → JWT → session in NEXTAUTH cookie

## Queue System
Bull + Redis: email sends, payroll processing, PDF generation (non-blocking)

## AI Integration
Claude API used for:
- HR assistant chatbot (natural language queries)
- Performance review summaries
- Candidate AI assessment
- Compliance alerts
