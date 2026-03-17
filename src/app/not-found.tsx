import Link from 'next/link';
import { FileQuestion } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="flex max-w-md flex-col items-center text-center animate-fade-in">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-blue-light text-blue">
          <FileQuestion className="h-7 w-7" />
        </div>

        <h1 className="mb-2 font-heading text-2xl text-foreground">
          Page Not Found
        </h1>

        <p className="mb-8 text-sm leading-relaxed text-muted-foreground">
          The page you are looking for does not exist or has been moved.
          Check the URL or head back to the dashboard.
        </p>

        <Button asChild>
          <Link href="/">Go to Dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
