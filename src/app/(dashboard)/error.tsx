'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[DashboardError]', error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
      <div className="flex max-w-md flex-col items-center text-center animate-fade-in">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-error-light text-error">
          <AlertTriangle className="h-7 w-7" />
        </div>

        <h1 className="mb-2 font-heading text-2xl text-foreground">
          Something Went Wrong
        </h1>

        <p className="mb-8 text-sm leading-relaxed text-muted-foreground">
          An error occurred while loading this page. You can try again or return
          to the dashboard.
        </p>

        <div className="flex items-center gap-3">
          <Button variant="outline" asChild>
            <Link href="/">Go to Dashboard</Link>
          </Button>
          <Button onClick={reset}>Try Again</Button>
        </div>
      </div>
    </div>
  );
}
