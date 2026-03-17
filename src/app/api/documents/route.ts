import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { checkPermission, handleApiError } from '@/lib/rbac/middleware';
import { hasPermission } from '@/lib/rbac/permissions';
import { withAudit } from '@/lib/audit';
import {
  createDocumentSchema,
  documentListQuerySchema,
} from '@/lib/validations/documents';
import { addDays } from 'date-fns';

// ---------------------------------------------------------------------------
// Roles that get unrestricted access to all documents within their company
// ---------------------------------------------------------------------------
const HR_PLUS_ROLES = ['SUPER_ADMIN', 'HR_ADMIN', 'HR_MANAGER'];

// ---------------------------------------------------------------------------
// GET /api/documents
// ---------------------------------------------------------------------------
// Role-based access:
//   EMPLOYEE  -> own documents only
//   MANAGER   -> own + direct reports' documents
//   HR+ roles -> all documents in the company
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const sessionUser = session.user as any;
    const userRole: string = sessionUser.role;
    const companyId: string = sessionUser.companyId;
    const sessionEmployeeId: string = sessionUser.employeeId;

    // Parse query params
    const { searchParams } = new URL(req.url);
    const query = documentListQuerySchema.parse({
      employeeId: searchParams.get('employeeId') ?? undefined,
      category: searchParams.get('category') ?? undefined,
      page: searchParams.get('page') ?? undefined,
      pageSize: searchParams.get('pageSize') ?? undefined,
    });

    const { page, pageSize, category, employeeId: filterEmployeeId } = query;

    // ------------------------------------------------------------------
    // Build the where clause based on role
    // ------------------------------------------------------------------
    let allowedEmployeeIds: string[] | undefined;

    if (HR_PLUS_ROLES.includes(userRole)) {
      // HR+ sees everything within the company — no employee filter enforced.
      // If a specific employeeId filter is requested, honour it.
      allowedEmployeeIds = undefined;
    } else if (userRole === 'MANAGER') {
      // Manager: own docs + direct reports
      const directReports = await db.employee.findMany({
        where: { reportingToId: sessionEmployeeId },
        select: { id: true },
      });
      allowedEmployeeIds = [
        sessionEmployeeId,
        ...directReports.map((r) => r.id),
      ];
    } else {
      // EMPLOYEE / any other role: own docs only
      allowedEmployeeIds = [sessionEmployeeId];
    }

    // If a filterEmployeeId is provided, intersect it with allowed IDs
    if (filterEmployeeId) {
      if (allowedEmployeeIds && !allowedEmployeeIds.includes(filterEmployeeId)) {
        return NextResponse.json(
          { error: 'You do not have access to this employee\'s documents' },
          { status: 403 }
        );
      }
      // Narrow the query to just this employee
      allowedEmployeeIds = [filterEmployeeId];
    }

    // Build Prisma where object
    const where: any = {
      employee: { companyId },
      ...(allowedEmployeeIds && { employeeId: { in: allowedEmployeeIds } }),
      ...(category && { category }),
    };

    const [documents, total] = await Promise.all([
      db.employeeDocument.findMany({
        where,
        include: {
          employee: {
            select: { id: true, firstName: true, lastName: true, employeeId: true },
          },
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      db.employeeDocument.count({ where }),
    ]);

    // Add expiry warning flag: isExpiring = true when expiresAt is within 30 days
    const now = new Date();
    const thirtyDaysFromNow = addDays(now, 30);

    const data = documents.map((doc) => ({
      ...doc,
      isExpiring: doc.expiresAt ? doc.expiresAt <= thirtyDaysFromNow : false,
    }));

    return NextResponse.json({
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

// ---------------------------------------------------------------------------
// POST /api/documents
// ---------------------------------------------------------------------------
// Permission: documents:upload
// EMPLOYEE role can only upload for themselves
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    await checkPermission(session, 'documents:upload');

    const sessionUser = session!.user as any;
    const userRole: string = sessionUser.role;
    const companyId: string = sessionUser.companyId;
    const sessionEmployeeId: string = sessionUser.employeeId;

    const body = await req.json();
    const validated = createDocumentSchema.parse(body);

    // EMPLOYEE role: can only upload documents for themselves
    if (userRole === 'EMPLOYEE' && validated.employeeId !== sessionEmployeeId) {
      return NextResponse.json(
        { error: 'You can only upload documents for yourself' },
        { status: 403 }
      );
    }

    // MANAGER role: can upload for self + direct reports
    if (userRole === 'MANAGER' && validated.employeeId !== sessionEmployeeId) {
      const isDirectReport = await db.employee.findFirst({
        where: {
          id: validated.employeeId,
          reportingToId: sessionEmployeeId,
        },
        select: { id: true },
      });
      if (!isDirectReport) {
        return NextResponse.json(
          { error: 'You can only upload documents for yourself or your direct reports' },
          { status: 403 }
        );
      }
    }

    // Verify the target employee belongs to the same company
    const targetEmployee = await db.employee.findUnique({
      where: { id: validated.employeeId },
      select: { id: true, companyId: true },
    });

    if (!targetEmployee || targetEmployee.companyId !== companyId) {
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404 }
      );
    }

    // Create the document with atomic audit logging
    const auditParams = {
      companyId,
      actorId: sessionEmployeeId,
      action: 'CREATE' as const,
      resource: 'EmployeeDocument',
      resourceId: '', // Will be set after creation
      after: {
        employeeId: validated.employeeId,
        category: validated.category,
        name: validated.name,
        isConfidential: validated.isConfidential,
      },
      ipAddress: req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip'),
      userAgent: req.headers.get('user-agent'),
    };

    const document = await withAudit(auditParams, async (tx) => {
      const created = await tx.employeeDocument.create({
        data: {
          employeeId: validated.employeeId,
          category: validated.category,
          name: validated.name,
          fileUrl: validated.fileUrl,
          fileSize: validated.fileSize ?? null,
          mimeType: validated.mimeType ?? null,
          expiresAt: validated.expiresAt ? new Date(validated.expiresAt) : null,
          isConfidential: validated.isConfidential ?? false,
          uploadedById: sessionEmployeeId,
        },
        include: {
          employee: {
            select: { id: true, firstName: true, lastName: true, employeeId: true },
          },
        },
      });

      // Set the real resource ID on the audit params (see withAudit-resourceId-for-creates pattern)
      auditParams.resourceId = created.id;

      return created;
    });

    return NextResponse.json({ data: document }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
