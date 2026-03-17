'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';
import { Button, type ButtonProps } from '@/components/ui/button';

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    variant?: ButtonProps['variant'];
  };
}

const EmptyState = React.forwardRef<HTMLDivElement, EmptyStateProps>(
  ({ className, icon, title, description, action, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'flex min-h-[400px] flex-col items-center justify-center rounded-lg border border-dashed border-[#0B0F1A]/20 bg-[#0B0F1A]/[0.02] p-8 text-center',
          className
        )}
        {...props}
      >
        {icon && (
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#4B9EFF]/10 text-[#4B9EFF]">
            {icon}
          </div>
        )}
        <h3 className="mb-2 text-lg font-semibold font-[\"DM_Serif_Display\"] text-[#0B0F1A]">
          {title}
        </h3>
        {description && (
          <p className="mb-6 max-w-sm text-sm font-[Syne] text-[#0B0F1A]/60">
            {description}
          </p>
        )}
        {action && (
          <Button
            variant={action.variant ?? 'default'}
            onClick={action.onClick}
          >
            {action.label}
          </Button>
        )}
      </div>
    );
  }
);
EmptyState.displayName = 'EmptyState';

export { EmptyState };
