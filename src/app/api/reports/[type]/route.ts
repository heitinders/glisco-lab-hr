import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { checkPermission, handleApiError } from '@/lib/rbac/middleware';
import { hasPermission } from '@/lib/rbac/permissions';
import {
  generateReport,
  VALID_REPORT_TYPES,
  type ReportFilters,
} from '@/lib/reports/generator';

const HR_PLUS_ROLES = ['SUPER_ADMIN', 'HR_ADMIN', 'HR_MANAGER'] as const;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  try {
    const session = await auth();
    await checkPermission(session, 'reports:view');

    const { type } = await params;

    // Validate report type
    if (!VALID_REPORT_TYPES.includes(type as any)) {
      return NextResponse.json(
        {
          error: `Invalid report type '${type}'. Valid types: ${VALID_REPORT_TYPES.join(', ')}`,
        },
        { status: 422 }
      );
    }

    const companyId = (session!.user as any).companyId;
    if (!companyId) {
      return NextResponse.json(
        { error: 'Company context required' },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(req.url);
    const filters: ReportFilters = {
      dateFrom: searchParams.get('dateFrom') || undefined,
      dateTo: searchParams.get('dateTo') || undefined,
      department: searchParams.get('department') || undefined,
      region: searchParams.get('region') || undefined,
    };

    // MANAGER role: scope to their direct reports only
    const userRole = (session!.user as any).role as string;
    const isHrPlus = HR_PLUS_ROLES.includes(userRole as any) ||
      hasPermission(userRole, 'reports:advanced');

    if (!isHrPlus && userRole === 'MANAGER') {
      const employeeId = (session!.user as any).employeeId;
      if (employeeId) {
        filters.managerId = employeeId;
      }
    }

    const result = await generateReport(type, companyId, filters);

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
