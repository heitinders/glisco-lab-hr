'use client';

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium font-[Syne] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4B9EFF] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:
          'bg-[#0B0F1A] text-white shadow hover:bg-[#0B0F1A]/90',
        destructive:
          'bg-red-500 text-white shadow-sm hover:bg-red-500/90',
        outline:
          'border border-[#0B0F1A]/20 bg-white shadow-sm hover:bg-[#0B0F1A]/5 hover:text-[#0B0F1A]',
        secondary:
          'bg-[#4B9EFF] text-white shadow-sm hover:bg-[#4B9EFF]/80',
        ghost:
          'hover:bg-[#0B0F1A]/5 hover:text-[#0B0F1A]',
        link: 'text-[#4B9EFF] underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3',
        lg: 'h-11 rounded-md px-8',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
