'use client';

import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[RootError]', error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="flex max-w-md flex-col items-center text-center animate-fade-in">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-error-light text-error">
          <AlertTriangle className="h-7 w-7" />
        </div>

        <h1 className="mb-2 font-heading text-2xl text-foreground">
          Something Went Wrong
        </h1>

        <p className="mb-8 text-sm leading-relaxed text-muted-foreground">
          An unexpected error occurred. Please try again. If the problem
          persists, contact your system administrator.
        </p>

        <Button onClick={reset}>Try Again</Button>
      </div>
    </div>
  );
}
