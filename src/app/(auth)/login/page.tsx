'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { signIn } from 'next-auth/react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/* ── Validation schema ───────────────────────────────────────────────── */

const loginSchema = z.object({
  email: z.email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  rememberMe: z.boolean().optional(),
});

type LoginFormData = z.infer<typeof loginSchema>;

/* ── Login page ──────────────────────────────────────────────────────── */

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    defaultValues: {
      email: '',
      password: '',
      rememberMe: false,
    },
  });

  const router = useRouter();

  async function onSubmit(data: LoginFormData) {
    setServerError(null);

    try {
      const result = await signIn('credentials', {
        email: data.email,
        password: data.password,
        redirect: false,
      });

      if (result?.error) {
        if (result.error.includes('locked')) {
          setServerError('Account locked. Try again in 15 minutes.');
          toast.error('Account locked. Try again in 15 minutes.');
        } else {
          setServerError('Invalid email or password.');
          toast.error('Invalid email or password.');
        }
        return;
      }

      toast.success('Signed in successfully');
      router.push('/');
      router.refresh();
    } catch {
      setServerError('An unexpected error occurred. Please try again.');
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
        <p className="mt-3 text-sm text-white/50">
          Sign in to your HR management platform
        </p>
      </div>

      {/* Card */}
      <div className="rounded-2xl border border-white/10 bg-navy-light p-8 shadow-2xl backdrop-blur-sm">
        <h1 className="font-heading text-2xl text-white">Welcome back</h1>
        <p className="mt-1 text-sm text-white/50">
          Enter your credentials to access your account
        </p>

        {/* Server error */}
        {serverError && (
          <div
            className="mt-4 rounded-lg bg-error/10 px-4 py-3 text-sm text-error"
            role="alert"
          >
            {serverError}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-5" noValidate>
          {/* Email */}
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

          {/* Password */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="password"
                className="text-sm font-medium text-white/70"
              >
                Password
              </label>
              <Link
                href="/forgot-password"
                className="text-xs font-medium text-blue hover:text-blue-hover"
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                autoComplete="current-password"
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
          </div>

          {/* Remember me */}
          <div className="flex items-center gap-2">
            <input
              id="rememberMe"
              type="checkbox"
              className="h-4 w-4 rounded border-white/20 bg-navy-lighter text-blue focus:ring-blue focus:ring-offset-0"
              {...register('rememberMe')}
            />
            <label htmlFor="rememberMe" className="text-sm text-white/50">
              Remember me for 30 days
            </label>
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
                Signing in...
              </>
            ) : (
              'Sign in'
            )}
          </Button>
        </form>
      </div>

      {/* Footer */}
      <p className="mt-6 text-center text-xs text-white/30">
        GliscoHR by Glisco Lab. All rights reserved.
      </p>
    </div>
  );
}
