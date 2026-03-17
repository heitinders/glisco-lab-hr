import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold font-[Syne] transition-colors focus:outline-none focus:ring-2 focus:ring-[#4B9EFF] focus:ring-offset-2',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-[#0B0F1A] text-white shadow hover:bg-[#0B0F1A]/80',
        secondary:
          'border-transparent bg-[#4B9EFF]/10 text-[#4B9EFF] hover:bg-[#4B9EFF]/20',
        destructive:
          'border-transparent bg-red-500/10 text-red-600 shadow hover:bg-red-500/20',
        outline:
          'border-[#0B0F1A]/20 text-[#0B0F1A]',
        success:
          'border-transparent bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20',
        warning:
          'border-transparent bg-amber-500/10 text-amber-600 hover:bg-amber-500/20',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(badgeVariants({ variant }), className)}
        {...props}
      />
    );
  }
);
Badge.displayName = 'Badge';

export { Badge, badgeVariants };
