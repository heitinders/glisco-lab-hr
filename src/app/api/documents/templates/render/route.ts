import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { checkPermission, handleApiError } from '@/lib/rbac/middleware';
import { renderTemplateSchema } from '@/lib/validations/documents';

// ---------------------------------------------------------------------------
// POST /api/documents/templates/render
// ---------------------------------------------------------------------------
// Permission: documents:manage (HR+ only)
// Accepts a templateId and a map of variable values, replaces all
// {{variableName}} placeholders in the template content, and returns
// the populated HTML string.
//
// Common variables: employeeName, designation, startDate, salary,
//                   companyName, date
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    await checkPermission(session, 'documents:manage');

    const sessionUser = session!.user as any;
    const companyId: string = sessionUser.companyId;

    const body = await req.json();
    const { templateId, variables } = renderTemplateSchema.parse(body);

    // Fetch the template and verify company boundary + active status
    const template = await db.documentTemplate.findUnique({
      where: { id: templateId },
    });

    if (!template || template.companyId !== companyId) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }

    if (!template.isActive) {
      return NextResponse.json(
        { error: 'Template is inactive and cannot be rendered' },
        { status: 422 }
      );
    }

    // Replace all {{variableName}} placeholders with provided values.
    // Unmatched placeholders are left as-is so callers can detect missing data.
    let rendered = template.content;
    for (const [key, value] of Object.entries(variables)) {
      // Use a global regex to replace all occurrences of the placeholder
      const placeholder = new RegExp(`\\{\\{\\s*${escapeRegex(key)}\\s*\\}\\}`, 'g');
      rendered = rendered.replace(placeholder, value);
    }

    return NextResponse.json({
      data: {
        templateId: template.id,
        templateName: template.name,
        category: template.category,
        version: template.version,
        html: rendered,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

// ---------------------------------------------------------------------------
// Escape special regex characters in a string so it can be used literally
// in a RegExp constructor.
// ---------------------------------------------------------------------------
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
