import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { checkPermission, handleApiError } from '@/lib/rbac/middleware';
import { createAuditEntry } from '@/lib/audit';
import { z } from 'zod';
import { differenceInMinutes } from 'date-fns';

const clockSchema = z.object({
  action: z.enum(['clock_in', 'clock_out']),
  notes: z.string().max(500).optional(),
});

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    await checkPermission(session, 'attendance:view_own');

    const employeeId = (session!.user as any).employeeId;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayRecord = await db.attendance.findUnique({
      where: {
        employeeId_date: {
          employeeId,
          date: today,
        },
      },
    });

    return NextResponse.json({
      data: todayRecord,
      isClockedIn: !!todayRecord?.clockIn && !todayRecord?.clockOut,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    await checkPermission(session, 'attendance:view_own');

    const body = await req.json();
    const validated = clockSchema.parse(body);

    const employeeId = (session!.user as any).employeeId as string;
    const companyId = (session!.user as any).companyId as string;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (validated.action === 'clock_in') {
      // Check if already clocked in today
      const existing = await db.attendance.findUnique({
        where: { employeeId_date: { employeeId, date: today } },
      });

      if (existing?.clockIn && !existing.clockOut) {
        return NextResponse.json(
          { error: 'Already clocked in today' },
          { status: 409 }
        );
      }

      if (existing?.clockOut) {
        return NextResponse.json(
          { error: 'Already completed attendance for today' },
          { status: 409 }
        );
      }

      // Check if late (after 9:15 AM = shift start 9:00 + 15 min grace)
      const shiftStartHour = 9;
      const gracePeriodMinutes = 15;
      const minutesSinceMidnight = now.getHours() * 60 + now.getMinutes();
      const isLate = minutesSinceMidnight > shiftStartHour * 60 + gracePeriodMinutes;

      const record = await db.$transaction(async (tx) => {
        const attendance = await tx.attendance.create({
          data: {
            employeeId,
            date: today,
            clockIn: now,
            status: 'PRESENT',
            isLate,
            notes: validated.notes ?? null,
            ipAddress: req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip'),
          },
        });

        await tx.auditLog.create({
          data: createAuditEntry({
            companyId,
            actorId: employeeId,
            action: 'CREATE',
            resource: 'Attendance',
            resourceId: attendance.id,
            after: { action: 'clock_in', clockIn: now.toISOString(), isLate },
          }),
        });

        return attendance;
      });

      return NextResponse.json({ data: record, isClockedIn: true }, { status: 201 });
    }

    // CLOCK_OUT
    const existing = await db.attendance.findUnique({
      where: { employeeId_date: { employeeId, date: today } },
    });

    if (!existing || !existing.clockIn || existing.clockOut) {
      return NextResponse.json(
        { error: 'Not clocked in today' },
        { status: 409 }
      );
    }

    const minutesWorked = differenceInMinutes(now, existing.clockIn);
    const hoursWorked = Math.round((minutesWorked / 60) * 100) / 100;
    const overtimeHours = Math.max(0, Math.round((hoursWorked - 8) * 100) / 100);

    const record = await db.$transaction(async (tx) => {
      const updated = await tx.attendance.update({
        where: { id: existing.id },
        data: {
          clockOut: now,
          hoursWorked,
          overtimeHours: overtimeHours > 0 ? overtimeHours : null,
          notes: validated.notes ? `${existing.notes ?? ''}\n${validated.notes}`.trim() : existing.notes,
        },
      });

      await tx.auditLog.create({
        data: createAuditEntry({
          companyId,
          actorId: employeeId,
          action: 'UPDATE',
          resource: 'Attendance',
          resourceId: existing.id,
          after: { action: 'clock_out', clockOut: now.toISOString(), hoursWorked, overtimeHours },
        }),
      });

      return updated;
    });

    return NextResponse.json({ data: record, isClockedIn: false });
  } catch (error) {
    return handleApiError(error);
  }
}
