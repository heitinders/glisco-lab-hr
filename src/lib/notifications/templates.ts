/**
 * Email HTML template functions for GliscoHR notifications.
 *
 * Each function returns { subject, html } with clean, professional,
 * inline-styled email content. Templates follow a consistent layout:
 * dark header with "GliscoHR" branding, a body section, and a footer.
 */

// ─── Shared Layout ──────────────────────────────────────────────────────────

function wrapInLayout(bodyContent: string): string {
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
              ${bodyContent}
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

function ctaButton(text: string, href: string): string {
  return `<p style="margin: 24px 0 0;">
    <a href="${href}" style="display: inline-block; padding: 10px 20px; background-color: #4B9EFF; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px;">
      ${text}
    </a>
  </p>`;
}

// ─── Templates ──────────────────────────────────────────────────────────────

export function leaveApprovedEmail(data: {
  employeeName: string;
  leaveType: string;
  dates: string;
}): { subject: string; html: string } {
  const subject = `Leave Approved - ${data.leaveType}`;
  const html = wrapInLayout(`
    <p style="margin: 0 0 16px; color: #374151; font-size: 15px;">Hi ${data.employeeName},</p>
    <h2 style="margin: 0 0 12px; color: #111827; font-size: 18px; font-weight: 600;">Your Leave Has Been Approved</h2>
    <p style="margin: 0 0 8px; color: #374151; font-size: 15px; line-height: 1.6;">
      Your <strong>${data.leaveType}</strong> leave request for <strong>${data.dates}</strong> has been approved.
    </p>
    <p style="margin: 16px 0 0; color: #374151; font-size: 15px; line-height: 1.6;">
      Please ensure any pending work is delegated before your leave begins. If you need to make any changes, please contact your manager or HR.
    </p>
    ${ctaButton('View Leave Details', `${process.env.NEXT_PUBLIC_APP_URL || ''}/leave`)}
  `);
  return { subject, html };
}

export function leaveRejectedEmail(data: {
  employeeName: string;
  leaveType: string;
  reason: string;
}): { subject: string; html: string } {
  const subject = `Leave Request Declined - ${data.leaveType}`;
  const html = wrapInLayout(`
    <p style="margin: 0 0 16px; color: #374151; font-size: 15px;">Hi ${data.employeeName},</p>
    <h2 style="margin: 0 0 12px; color: #111827; font-size: 18px; font-weight: 600;">Your Leave Request Was Declined</h2>
    <p style="margin: 0 0 8px; color: #374151; font-size: 15px; line-height: 1.6;">
      Unfortunately, your <strong>${data.leaveType}</strong> leave request has been declined.
    </p>
    <div style="margin: 16px 0; padding: 16px; background-color: #fef2f2; border-radius: 6px; border-left: 4px solid #ef4444;">
      <p style="margin: 0; color: #991b1b; font-size: 14px; font-weight: 600;">Reason</p>
      <p style="margin: 4px 0 0; color: #374151; font-size: 14px; line-height: 1.5;">${data.reason}</p>
    </div>
    <p style="margin: 16px 0 0; color: #374151; font-size: 15px; line-height: 1.6;">
      If you have any questions, please reach out to your manager or HR for further clarification.
    </p>
    ${ctaButton('View Leave Details', `${process.env.NEXT_PUBLIC_APP_URL || ''}/leave`)}
  `);
  return { subject, html };
}

export function reviewDueEmail(data: {
  employeeName: string;
  cycleName: string;
  deadline: string;
}): { subject: string; html: string } {
  const subject = `Performance Review Due - ${data.cycleName}`;
  const html = wrapInLayout(`
    <p style="margin: 0 0 16px; color: #374151; font-size: 15px;">Hi ${data.employeeName},</p>
    <h2 style="margin: 0 0 12px; color: #111827; font-size: 18px; font-weight: 600;">Performance Review Reminder</h2>
    <p style="margin: 0 0 8px; color: #374151; font-size: 15px; line-height: 1.6;">
      Your performance review for the <strong>${data.cycleName}</strong> cycle is due by <strong>${data.deadline}</strong>.
    </p>
    <div style="margin: 16px 0; padding: 16px; background-color: #fefce8; border-radius: 6px; border-left: 4px solid #eab308;">
      <p style="margin: 0; color: #854d0e; font-size: 14px; font-weight: 600;">Action Required</p>
      <p style="margin: 4px 0 0; color: #374151; font-size: 14px; line-height: 1.5;">
        Please complete your review before the deadline to ensure timely processing.
      </p>
    </div>
    ${ctaButton('Complete Review', `${process.env.NEXT_PUBLIC_APP_URL || ''}/performance`)}
  `);
  return { subject, html };
}

export function payslipReadyEmail(data: {
  employeeName: string;
  period: string;
}): { subject: string; html: string } {
  const subject = `Payslip Ready - ${data.period}`;
  const html = wrapInLayout(`
    <p style="margin: 0 0 16px; color: #374151; font-size: 15px;">Hi ${data.employeeName},</p>
    <h2 style="margin: 0 0 12px; color: #111827; font-size: 18px; font-weight: 600;">Your Payslip Is Ready</h2>
    <p style="margin: 0 0 8px; color: #374151; font-size: 15px; line-height: 1.6;">
      Your payslip for <strong>${data.period}</strong> is now available. You can view and download it from your dashboard.
    </p>
    <p style="margin: 16px 0 0; color: #6b7280; font-size: 14px; line-height: 1.5;">
      If you notice any discrepancies, please contact the HR or Finance team within 5 business days.
    </p>
    ${ctaButton('View Payslip', `${process.env.NEXT_PUBLIC_APP_URL || ''}/payroll`)}
  `);
  return { subject, html };
}

export function welcomeEmail(data: {
  employeeName: string;
  companyName: string;
  startDate: string;
}): { subject: string; html: string } {
  const subject = `Welcome to ${data.companyName}!`;
  const html = wrapInLayout(`
    <p style="margin: 0 0 16px; color: #374151; font-size: 15px;">Hi ${data.employeeName},</p>
    <h2 style="margin: 0 0 12px; color: #111827; font-size: 18px; font-weight: 600;">Welcome to ${data.companyName}!</h2>
    <p style="margin: 0 0 8px; color: #374151; font-size: 15px; line-height: 1.6;">
      We are thrilled to have you join the team. Your start date is <strong>${data.startDate}</strong>.
    </p>
    <p style="margin: 16px 0 0; color: #374151; font-size: 15px; line-height: 1.6;">
      Before your first day, please log in to GliscoHR to complete your onboarding tasks, upload required documents, and review company policies.
    </p>
    <div style="margin: 16px 0; padding: 16px; background-color: #f0fdf4; border-radius: 6px; border-left: 4px solid #22c55e;">
      <p style="margin: 0; color: #166534; font-size: 14px; font-weight: 600;">Getting Started</p>
      <p style="margin: 4px 0 0; color: #374151; font-size: 14px; line-height: 1.5;">
        Log in to your account, complete your profile, and check your onboarding checklist. Your manager and HR team are here to help with any questions.
      </p>
    </div>
    ${ctaButton('Get Started', `${process.env.NEXT_PUBLIC_APP_URL || ''}/onboarding`)}
  `);
  return { subject, html };
}
