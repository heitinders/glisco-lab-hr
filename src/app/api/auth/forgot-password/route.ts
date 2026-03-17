import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sendEmail } from '@/lib/email/sender';

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { message: 'If an account exists, a reset link has been sent.' },
        { status: 200 },
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Look up user — but always return 200 to prevent enumeration
    const user = await db.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, email: true },
    });

    if (user) {
      // Delete any existing tokens for this email
      await db.verificationToken.deleteMany({
        where: { identifier: normalizedEmail },
      });

      // Generate secure token
      const rawToken = crypto.randomBytes(32).toString('hex');
      const hashedToken = crypto
        .createHash('sha256')
        .update(rawToken)
        .digest('hex');

      // Store hashed token with 1-hour expiry
      await db.verificationToken.create({
        data: {
          identifier: normalizedEmail,
          token: hashedToken,
          expires: new Date(Date.now() + 60 * 60 * 1000),
        },
      });

      // Build reset link
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const resetLink = `${baseUrl}/reset-password?token=${rawToken}&email=${encodeURIComponent(normalizedEmail)}`;

      // Send reset email
      await sendEmail({
        to: normalizedEmail,
        subject: 'Reset your GliscoHR password',
        html: `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
            <h2 style="color: #1a1a2e;">Reset your password</h2>
            <p style="color: #555; line-height: 1.6;">
              You requested a password reset for your GliscoHR account.
              Click the button below to set a new password. This link expires in 1 hour.
            </p>
            <a
              href="${resetLink}"
              style="display: inline-block; padding: 12px 24px; background: #4B9EFF; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 16px 0;"
            >
              Reset password
            </a>
            <p style="color: #999; font-size: 13px; line-height: 1.5;">
              If you didn't request this, you can safely ignore this email.
              Your password will not be changed.
            </p>
          </div>
        `,
      });
    }

    return NextResponse.json(
      { message: 'If an account exists, a reset link has been sent.' },
      { status: 200 },
    );
  } catch (error) {
    console.error('Forgot password error:', error);
    return NextResponse.json(
      { message: 'If an account exists, a reset link has been sent.' },
      { status: 200 },
    );
  }
}
