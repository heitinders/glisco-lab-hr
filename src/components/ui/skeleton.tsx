import * as React from 'react';

import { cn } from '@/lib/utils';

const Skeleton = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn(
        'animate-pulse rounded-md bg-[#0B0F1A]/10',
        className
      )}
      {...props}
    />
  );
});
Skeleton.displayName = 'Skeleton';

export { Skeleton };
