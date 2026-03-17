'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Eye, EyeOff, Loader2, Lock, CheckCircle, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/* ── Types ───────────────────────────────────────────────────────────── */

interface ResetPasswordFormData {
  password: string;
  confirmPassword: string;
}

/* ── Password requirements ───────────────────────────────────────────── */

const PASSWORD_REQUIREMENTS = [
  { label: 'At least 8 characters', test: (v: string) => v.length >= 8 },
  { label: 'One uppercase letter', test: (v: string) => /[A-Z]/.test(v) },
  { label: 'One lowercase letter', test: (v: string) => /[a-z]/.test(v) },
  { label: 'One number', test: (v: string) => /\d/.test(v) },
];

/* ── Reset password page ─────────────────────────────────────────────── */

export default function ResetPasswordPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const email = searchParams.get('email');

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormData>({
    defaultValues: { password: '', confirmPassword: '' },
  });

  const passwordValue = watch('password', '');

  // Show error state if token or email is missing from URL
  if (!token || !email) {
    return (
      <div className="mx-auto w-full max-w-md">
        <div className="mb-8 text-center">
          <Link href="/" className="inline-flex items-center gap-3">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-blue">
              <span className="font-heading text-lg text-white">G</span>
              <div className="absolute -right-0.5 top-1 h-5 w-0.5 rotate-12 bg-white/60" />
            </div>
            <span className="font-heading text-3xl tracking-tight text-white">
              GliscoHR
            </span>
          </Link>
        </div>
        <div className="rounded-2xl border border-white/10 bg-navy-light p-8 shadow-2xl backdrop-blur-sm">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-error/10">
              <AlertTriangle className="h-7 w-7 text-error" />
            </div>
            <h1 className="font-heading text-2xl text-white">Invalid reset link</h1>
            <p className="mt-2 text-sm text-white/50">
              This password reset link is invalid or incomplete. Please request a new one.
            </p>
            <Link href="/forgot-password">
              <Button variant="secondary" className="mt-6 h-11 w-full text-sm font-semibold">
                Request new reset link
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  async function onSubmit(data: ResetPasswordFormData) {
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, email, password: data.password }),
      });

      const result = await res.json();

      if (!res.ok) {
        toast.error(result.message || 'Failed to reset password.');
        return;
      }

      toast.success('Password reset successfully.');
      setSuccess(true);
    } catch {
      toast.error('Something went wrong. Please try again.');
    }
  }

  return (
    <div className="mx-auto w-full max-w-md">
      {/* Logo */}
      <div className="mb-8 text-center">
        <Link href="/" className="inline-flex items-center gap-3">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-blue">
            <span className="font-heading text-lg text-white">G</span>
            <div className="absolute -right-0.5 top-1 h-5 w-0.5 rotate-12 bg-white/60" />
          </div>
          <span className="font-heading text-3xl tracking-tight text-white">
            GliscoHR
          </span>
        </Link>
      </div>

      {/* Card */}
      <div className="rounded-2xl border border-white/10 bg-navy-light p-8 shadow-2xl backdrop-blur-sm">
        {success ? (
          /* Success state */
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-success/10">
              <CheckCircle className="h-7 w-7 text-success" />
            </div>
            <h1 className="font-heading text-2xl text-white">Password reset</h1>
            <p className="mt-2 text-sm text-white/50">
              Your password has been successfully reset. You can now sign in with
              your new password.
            </p>
            <Link href="/login">
              <Button variant="secondary" className="mt-6 h-11 w-full text-sm font-semibold">
                Continue to sign in
              </Button>
            </Link>
          </div>
        ) : (
          /* Form state */
          <>
            <div className="mb-1 flex h-12 w-12 items-center justify-center rounded-xl bg-blue/10">
              <Lock className="h-6 w-6 text-blue" />
            </div>
            <h1 className="mt-4 font-heading text-2xl text-white">
              Set new password
            </h1>
            <p className="mt-1 text-sm text-white/50">
              Your new password must be different from previously used passwords.
            </p>

            <form
              onSubmit={handleSubmit(onSubmit)}
              className="mt-6 space-y-5"
              noValidate
            >
              {/* New password */}
              <div className="space-y-1.5">
                <label
                  htmlFor="password"
                  className="text-sm font-medium text-white/70"
                >
                  New password
                </label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter new password"
                    autoComplete="new-password"
                    className={cn(
                      'border-white/10 bg-navy-lighter pr-10 text-white placeholder:text-white/30 focus-visible:ring-blue',
                      errors.password && 'border-error focus-visible:ring-error'
                    )}
                    {...register('password', {
                      required: 'Password is required',
                      minLength: {
                        value: 8,
                        message: 'Password must be at least 8 characters',
                      },
                      pattern: {
                        value: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/,
                        message:
                          'Password must include uppercase, lowercase, and a number',
                      },
                    })}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 transition-colors hover:text-white/60"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-xs text-error" role="alert">
                    {errors.password.message}
                  </p>
                )}

                {/* Password strength indicators */}
                <div className="mt-2 space-y-1.5">
                  {PASSWORD_REQUIREMENTS.map((req) => {
                    const met = req.test(passwordValue);
                    return (
                      <div
                        key={req.label}
                        className="flex items-center gap-2 text-xs"
                      >
                        <div
                          className={cn(
                            'h-1.5 w-1.5 rounded-full transition-colors',
                            met ? 'bg-success' : 'bg-white/20'
                          )}
                        />
                        <span
                          className={cn(
                            'transition-colors',
                            met ? 'text-success' : 'text-white/30'
                          )}
                        >
                          {req.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Confirm password */}
              <div className="space-y-1.5">
                <label
                  htmlFor="confirmPassword"
                  className="text-sm font-medium text-white/70"
                >
                  Confirm password
                </label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirm ? 'text' : 'password'}
                    placeholder="Confirm new password"
                    autoComplete="new-password"
                    className={cn(
                      'border-white/10 bg-navy-lighter pr-10 text-white placeholder:text-white/30 focus-visible:ring-blue',
                      errors.confirmPassword &&
                        'border-error focus-visible:ring-error'
                    )}
                    {...register('confirmPassword', {
                      required: 'Please confirm your password',
                      validate: (value) =>
                        value === passwordValue || 'Passwords do not match',
                    })}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 transition-colors hover:text-white/60"
                    aria-label={showConfirm ? 'Hide password' : 'Show password'}
                  >
                    {showConfirm ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {errors.confirmPassword && (
                  <p className="text-xs text-error" role="alert">
                    {errors.confirmPassword.message}
                  </p>
                )}
              </div>

              {/* Submit */}
              <Button
                type="submit"
                variant="secondary"
                className="h-11 w-full text-sm font-semibold"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Resetting...
                  </>
                ) : (
                  'Reset password'
                )}
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
