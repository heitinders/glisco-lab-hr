import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { checkPermission, handleApiError } from '@/lib/rbac/middleware';
import { withAudit } from '@/lib/audit';

// ---------------------------------------------------------------------------
// Roles that get unrestricted access to all documents within their company
// ---------------------------------------------------------------------------
const HR_PLUS_ROLES = ['SUPER_ADMIN', 'HR_ADMIN', 'HR_MANAGER'];

// ---------------------------------------------------------------------------
// Shared helper: fetch a document and verify the caller has access
// ---------------------------------------------------------------------------
async function fetchDocumentWithAccess(
  documentId: string,
  sessionUser: { role: string; companyId: string; employeeId: string }
): Promise<
  | { ok: true; document: any }
  | { ok: false; status: number; error: string }
> {
  const document = await db.employeeDocument.findUnique({
    where: { id: documentId },
    include: {
      employee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          employeeId: true,
          companyId: true,
          reportingToId: true,
        },
      },
    },
  });

  if (!document || document.employee.companyId !== sessionUser.companyId) {
    return { ok: false, status: 404, error: 'Document not found' };
  }

  // HR+ can access everything
  if (HR_PLUS_ROLES.includes(sessionUser.role)) {
    return { ok: true, document };
  }

  // MANAGER: own documents + direct reports
  if (sessionUser.role === 'MANAGER') {
    const isOwn = document.employeeId === sessionUser.employeeId;
    const isDirectReport = document.employee.reportingToId === sessionUser.employeeId;
    if (isOwn || isDirectReport) {
      return { ok: true, document };
    }
    return { ok: false, status: 403, error: 'You do not have access to this document' };
  }

  // EMPLOYEE / other roles: own documents only
  if (document.employeeId === sessionUser.employeeId) {
    return { ok: true, document };
  }

  return { ok: false, status: 403, error: 'You do not have access to this document' };
}

// ---------------------------------------------------------------------------
// GET /api/documents/[id]
// ---------------------------------------------------------------------------

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const sessionUser = session.user as any;
    const result = await fetchDocumentWithAccess(id, {
      role: sessionUser.role,
      companyId: sessionUser.companyId,
      employeeId: sessionUser.employeeId,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    // Strip internal fields from employee before returning
    const { companyId: _c, reportingToId: _r, ...employeeInfo } =
      result.document.employee;

    return NextResponse.json({
      data: {
        ...result.document,
        employee: employeeInfo,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/documents/[id]
// ---------------------------------------------------------------------------
// Permission: documents:manage (HR+ only)
// Hard delete (model has no isActive/soft-delete field)
// ---------------------------------------------------------------------------

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    await checkPermission(session, 'documents:manage');

    const sessionUser = session!.user as any;
    const companyId: string = sessionUser.companyId;
    const sessionEmployeeId: string = sessionUser.employeeId;

    // Fetch the document and verify company boundary
    const document = await db.employeeDocument.findUnique({
      where: { id },
      include: {
        employee: {
          select: { companyId: true },
        },
      },
    });

    if (!document || document.employee.companyId !== companyId) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Hard delete with atomic audit logging
    await withAudit(
      {
        companyId,
        actorId: sessionEmployeeId,
        action: 'DELETE',
        resource: 'EmployeeDocument',
        resourceId: id,
        before: {
          employeeId: document.employeeId,
          category: document.category,
          name: document.name,
          fileUrl: document.fileUrl,
          isConfidential: document.isConfidential,
        },
        after: null,
        ipAddress: req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip'),
        userAgent: req.headers.get('user-agent'),
      },
      async (tx) => {
        await tx.employeeDocument.delete({ where: { id } });
      }
    );

    return NextResponse.json({ message: 'Document deleted successfully' });
  } catch (error) {
    return handleApiError(error);
  }
}
