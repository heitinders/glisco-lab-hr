import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { checkPermission, handleApiError } from '@/lib/rbac/middleware';
import { templateListQuerySchema } from '@/lib/validations/documents';

// ---------------------------------------------------------------------------
// GET /api/documents/templates
// ---------------------------------------------------------------------------
// Permission: documents:view_all (HR+ only)
// Lists all active document templates for the session user's company.
// Optional filters: category, region
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    await checkPermission(session, 'documents:view_all');

    const sessionUser = session!.user as any;
    const companyId: string = sessionUser.companyId;

    const { searchParams } = new URL(req.url);
    const query = templateListQuerySchema.parse({
      category: searchParams.get('category') ?? undefined,
      region: searchParams.get('region') ?? undefined,
    });

    const where: any = {
      companyId,
      isActive: true,
      ...(query.category && { category: query.category }),
      ...(query.region && { region: query.region }),
    };

    const templates = await db.documentTemplate.findMany({
      where,
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        category: true,
        region: true,
        variables: true,
        version: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ data: templates });
  } catch (error) {
    return handleApiError(error);
  }
}
