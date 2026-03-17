# Reports Lib Context

## generator.ts
- `generateReport(type, companyId, filters)` dispatches to type-specific generators
- Each generator returns `{ data, columns, summary }`
- `VALID_REPORT_TYPES` is the single source of truth for allowed types
- `ReportFilters.managerId` scopes queries to a manager's direct reports (set by API route for MANAGER role)

## Report Types
- **headcount**: Employee distribution by dept/designation/region/status
- **leave**: Leave requests by type, department, date range
- **payroll**: PayrollRun summaries by period, region
- **turnover**: Joins/exits with turnover rate calculation
- **compliance**: Expiring docs, missing data, pending confirmations

## Adding a New Report
1. Add type to `VALID_REPORT_TYPES` array
2. Create `generateXxxReport()` function
3. Add case to `generateReport()` switch
4. Add card in `/src/app/(dashboard)/reports/page.tsx`
5. Add metadata in `/src/app/(dashboard)/reports/[type]/page.tsx` REPORT_META
