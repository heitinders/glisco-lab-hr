import crypto from 'crypto';
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';

const PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*\d).{8,}$/;

export async function POST(request: Request) {
  try {
    const { token, email, password } = await request.json();

    // Validate required fields
    if (!token || !email || !password) {
      return NextResponse.json(
        { message: 'Missing required fields.' },
        { status: 400 },
      );
    }

    // Validate password strength
    if (!PASSWORD_REGEX.test(password)) {
      return NextResponse.json(
        { message: 'Password must be at least 8 characters with at least 1 uppercase letter and 1 number.' },
        { status: 400 },
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Hash the incoming token the same way it was stored
    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    // Look up the verification token
    const verificationToken = await db.verificationToken.findUnique({
      where: { token: hashedToken },
    });

    if (!verificationToken) {
      return NextResponse.json(
        { message: 'Invalid or expired reset link.' },
        { status: 400 },
      );
    }

    // Validate token hasn't expired
    if (new Date() > verificationToken.expires) {
      // Clean up expired token
      await db.verificationToken.delete({
        where: { token: hashedToken },
      });
      return NextResponse.json(
        { message: 'Reset link has expired. Please request a new one.' },
        { status: 400 },
      );
    }

    // Validate identifier matches the provided email
    if (verificationToken.identifier !== normalizedEmail) {
      return NextResponse.json(
        { message: 'Invalid or expired reset link.' },
        { status: 400 },
      );
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(password, 12);

    // Update user password, reset lockout fields
    await db.user.update({
      where: { email: normalizedEmail },
      data: {
        passwordHash,
        loginAttempts: 0,
        lockedUntil: null,
      },
    });

    // Delete the used verification token
    await db.verificationToken.delete({
      where: { token: hashedToken },
    });

    return NextResponse.json(
      { message: 'Password reset successfully.' },
      { status: 200 },
    );
  } catch (error) {
    console.error('Reset password error:', error);
    return NextResponse.json(
      { message: 'Something went wrong. Please try again.' },
      { status: 500 },
    );
  }
}
