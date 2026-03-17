import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { handleApiError } from '@/lib/rbac/middleware';
import { fileUploadSchema } from '@/lib/validations/documents';
import crypto from 'crypto';

// ---------------------------------------------------------------------------
// POST /api/upload
// ---------------------------------------------------------------------------
// Accepts a JSON body with base64-encoded file data, validates type and size,
// and returns a URL that can be used as a fileUrl in document creation.
//
// !! IMPORTANT: This is a development stub. In production this should be
// replaced with UploadThing or a direct S3 integration. The current
// implementation stores files as data URIs, which is NOT suitable for
// production use due to storage and performance constraints. !!
//
// Accepted file types:
//   - PDF, JPEG, PNG, WebP
//   - Word (.doc, .docx)
//   - Excel (.xls, .xlsx)
//
// Max file size: 10 MB
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await req.json();
    const validated = fileUploadSchema.parse(body);

    // Validate that the base64 data is well-formed
    // Strip optional data URI prefix if present (e.g. "data:application/pdf;base64,")
    let rawBase64 = validated.base64Data;
    if (rawBase64.includes(',')) {
      rawBase64 = rawBase64.split(',')[1];
    }

    // Basic base64 format check
    if (!/^[A-Za-z0-9+/]+=*$/.test(rawBase64.replace(/\s/g, ''))) {
      return NextResponse.json(
        { error: 'Invalid base64 data' },
        { status: 422 }
      );
    }

    // Generate a unique file identifier
    const fileId = crypto.randomUUID();
    const sanitizedName = validated.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');

    // ------------------------------------------------------------------
    // TODO: Replace this with UploadThing or S3 integration in production.
    //
    // For UploadThing, use the UploadThing SDK to upload the buffer:
    //   const buffer = Buffer.from(rawBase64, 'base64');
    //   const result = await utapi.uploadFiles(
    //     new File([buffer], validated.fileName, { type: validated.fileType })
    //   );
    //   const url = result.data.url;
    //
    // For S3, use the AWS SDK:
    //   const buffer = Buffer.from(rawBase64, 'base64');
    //   const key = `documents/${fileId}/${sanitizedName}`;
    //   await s3.putObject({ Bucket, Key: key, Body: buffer, ContentType: validated.fileType });
    //   const url = `https://${Bucket}.s3.amazonaws.com/${key}`;
    // ------------------------------------------------------------------

    // Development stub: return a data URI
    const url = `data:${validated.fileType};base64,${rawBase64}`;

    return NextResponse.json(
      {
        url,
        name: validated.fileName,
        size: validated.fileSize,
        mimeType: validated.fileType,
        fileId,
      },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error);
  }
}

// ---------------------------------------------------------------------------
// GET /api/upload
// ---------------------------------------------------------------------------
// Returns upload configuration (allowed types, size limits)
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    return NextResponse.json({
      maxFileSize: 10 * 1024 * 1024, // 10 MB in bytes
      maxFileSizeMB: 10,
      allowedTypes: [
        'application/pdf',
        'image/jpeg',
        'image/png',
        'image/webp',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ],
    });
  } catch (error) {
    return handleApiError(error);
  }
}
