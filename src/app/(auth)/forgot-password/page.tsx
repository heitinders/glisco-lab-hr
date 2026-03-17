'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { ArrowLeft, Loader2, Mail, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/* ── Types ───────────────────────────────────────────────────────────── */

interface ForgotPasswordFormData {
  email: string;
}

/* ── Forgot password page ────────────────────────────────────────────── */

export default function ForgotPasswordPage() {
  const [submitted, setSubmitted] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordFormData>({
    defaultValues: { email: '' },
  });

  async function onSubmit(data: ForgotPasswordFormData) {
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: data.email }),
      });

      if (!res.ok) {
        throw new Error('Request failed');
      }

      setSubmittedEmail(data.email);
      setSubmitted(true);
    } catch {
      // Always show success to prevent email enumeration
      setSubmittedEmail(data.email);
      setSubmitted(true);
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
        {submitted ? (
          /* Success state */
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-success/10">
              <CheckCircle className="h-7 w-7 text-success" />
            </div>
            <h1 className="font-heading text-2xl text-white">Check your email</h1>
            <p className="mt-2 text-sm text-white/50">
              We sent a password reset link to{' '}
              <span className="font-semibold text-white/70">{submittedEmail}</span>.
              Please check your inbox and follow the instructions.
            </p>
            <p className="mt-4 text-xs text-white/30">
              Didn&apos;t receive the email? Check your spam folder or{' '}
              <button
                type="button"
                onClick={() => setSubmitted(false)}
                className="font-medium text-blue hover:text-blue-hover"
              >
                try again
              </button>
              .
            </p>
            <Link
              href="/login"
              className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-blue hover:text-blue-hover"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to sign in
            </Link>
          </div>
        ) : (
          /* Form state */
          <>
            <div className="mb-1 flex h-12 w-12 items-center justify-center rounded-xl bg-blue/10">
              <Mail className="h-6 w-6 text-blue" />
            </div>
            <h1 className="mt-4 font-heading text-2xl text-white">
              Forgot your password?
            </h1>
            <p className="mt-1 text-sm text-white/50">
              No worries. Enter your email and we&apos;ll send you a reset link.
            </p>

            <form
              onSubmit={handleSubmit(onSubmit)}
              className="mt-6 space-y-5"
              noValidate
            >
              <div className="space-y-1.5">
                <label
                  htmlFor="email"
                  className="text-sm font-medium text-white/70"
                >
                  Email address
                </label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@gliscolab.com"
                  autoComplete="email"
                  className={cn(
                    'border-white/10 bg-navy-lighter text-white placeholder:text-white/30 focus-visible:ring-blue',
                    errors.email && 'border-error focus-visible:ring-error'
                  )}
                  {...register('email', {
                    required: 'Email is required',
                    pattern: {
                      value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                      message: 'Please enter a valid email address',
                    },
                  })}
                />
                {errors.email && (
                  <p className="text-xs text-error" role="alert">
                    {errors.email.message}
                  </p>
                )}
              </div>

              <Button
                type="submit"
                variant="secondary"
                className="h-11 w-full text-sm font-semibold"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  'Send reset link'
                )}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 text-sm font-medium text-white/50 hover:text-white"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to sign in
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
