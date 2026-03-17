'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-10 w-full rounded-md border border-[#0B0F1A]/20 bg-white px-3 py-2 text-sm font-[Syne] ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-[#0B0F1A] placeholder:text-[#0B0F1A]/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4B9EFF] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export { Input };
