'use client';

import * as React from 'react';
import {
  WifiOff,
  ShieldX,
  FileQuestion,
  AlertTriangle,
  type LucideIcon,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

type ErrorVariant = 'network' | 'permission' | 'not-found' | 'generic';

interface VariantConfig {
  icon: LucideIcon;
  title: string;
  defaultMessage: string;
}

const variantMap: Record<ErrorVariant, VariantConfig> = {
  network: {
    icon: WifiOff,
    title: 'Connection Error',
    defaultMessage:
      'Unable to reach the server. Please check your internet connection and try again.',
  },
  permission: {
    icon: ShieldX,
    title: 'Access Denied',
    defaultMessage:
      'You do not have permission to view this resource. Contact your administrator if you believe this is an error.',
  },
  'not-found': {
    icon: FileQuestion,
    title: 'Not Found',
    defaultMessage:
      'The resource you are looking for does not exist or has been moved.',
  },
  generic: {
    icon: AlertTriangle,
    title: 'Something Went Wrong',
    defaultMessage:
      'An unexpected error occurred. Please try again or contact support if the problem persists.',
  },
};

export interface ErrorStateProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: ErrorVariant;
  message?: string;
  onRetry?: () => void;
}

const ErrorState = React.forwardRef<HTMLDivElement, ErrorStateProps>(
  ({ className, variant = 'generic', message, onRetry, ...props }, ref) => {
    const config = variantMap[variant];
    const Icon = config.icon;

    return (
      <div
        ref={ref}
        className={cn(
          'flex min-h-[300px] flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 p-8 text-center animate-fade-in',
          className
        )}
        {...props}
      >
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-error-light text-error">
          <Icon className="h-6 w-6" />
        </div>

        <h3 className="mb-2 font-heading text-lg text-foreground">
          {config.title}
        </h3>

        <p className="mb-6 max-w-md text-sm text-muted-foreground">
          {message ?? config.defaultMessage}
        </p>

        {onRetry && (
          <Button variant="outline" onClick={onRetry}>
            Try Again
          </Button>
        )}
      </div>
    );
  }
);
ErrorState.displayName = 'ErrorState';

export { ErrorState };
