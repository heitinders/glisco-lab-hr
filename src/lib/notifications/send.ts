import { db } from '@/lib/db';
import { emailQueue } from '@/lib/queue/queues';
import type { NotificationType } from '@prisma/client';

interface NotifyParams {
  employeeId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  metadata?: Record<string, any>;
  /** Whether to also queue an email to the employee. Defaults to true. */
  sendEmail?: boolean;
}

/**
 * Create an in-app notification and optionally queue an email delivery.
 *
 * This function is designed to be called from API route handlers and
 * background workers. It performs two steps:
 *
 * 1. Inserts a Notification row into the database.
 * 2. If `sendEmail` is true (the default), looks up the employee's email
 *    address and adds a job to the email queue.
 *
 * Callers are responsible for building the email HTML before calling this
 * function — or they can set `sendEmail: false` and handle email separately.
 * When `sendEmail` is true, the function uses the `title` as the email
 * subject and the `message` as a plain-text fallback wrapped in minimal HTML.
 * For richer emails, prefer queuing email jobs directly with templates from
 * `@/lib/notifications/templates`.
 */
export async function notify(params: NotifyParams): Promise<void> {
  const {
    employeeId,
    type,
    title,
    message,
    link,
    metadata = {},
    sendEmail: shouldSendEmail = true,
  } = params;

  // 1. Persist notification in the database
  await db.notification.create({
    data: {
      employeeId,
      type,
      title,
      body: message,
      link: link ?? null,
      metadata,
    },
  });

  // 2. Queue an email if requested
  if (shouldSendEmail) {
    try {
      const employee = await db.employee.findUnique({
        where: { id: employeeId },
        select: { email: true, firstName: true, lastName: true },
      });

      if (employee?.email) {
        await emailQueue.add(
          {
            to: employee.email,
            subject: title,
            html: buildFallbackEmailHtml({
              title,
              body: message,
              link,
              recipientName: `${employee.firstName} ${employee.lastName}`,
            }),
          },
          {
            attempts: 3,
            backoff: { type: 'exponential', delay: 2000 },
          }
        );
      }
    } catch (err) {
      // Email queuing should not fail the notification creation.
      // Log the error and continue.
      console.error('[notify] Failed to queue email for notification:', err);
    }
  }
}

/**
 * Build a simple fallback HTML email when no dedicated template is provided.
 */
function buildFallbackEmailHtml(params: {
  title: string;
  body: string;
  link?: string;
  recipientName: string;
}): string {
  const { title, body, link, recipientName } = params;

  const linkBlock = link
    ? `<p style="margin: 24px 0;">
        <a href="${link}" style="display: inline-block; padding: 10px 20px; background-color: #4B9EFF; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600;">
          View Details
        </a>
      </p>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /></head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="background-color: #0f172a; padding: 24px 32px;">
              <h1 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 700;">GliscoHR</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0 0 16px; color: #374151; font-size: 15px;">Hi ${recipientName},</p>
              <h2 style="margin: 0 0 12px; color: #111827; font-size: 18px; font-weight: 600;">${title}</h2>
              <p style="margin: 0; color: #374151; font-size: 15px; line-height: 1.6;">${body}</p>
              ${linkBlock}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #9ca3af; font-size: 13px; text-align: center;">
                This is an automated message from GliscoHR. Please do not reply to this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
