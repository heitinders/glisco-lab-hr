import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { checkPermission, handleApiError } from '@/lib/rbac/middleware';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    await checkPermission(session, 'documents:view_all');

    const documents = await db.employeeDocument.findMany({
      where: { employeeId: params.id },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ data: documents });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    await checkPermission(session, 'documents:upload');

    const body = await req.json();

    // TODO: Validate document data
    // TODO: Create document record linked to employee
    // TODO: Audit log

    return NextResponse.json(
      { message: 'Employee document upload endpoint - implementation pending' },
      { status: 501 }
    );
  } catch (error) {
    return handleApiError(error);
  }
}
