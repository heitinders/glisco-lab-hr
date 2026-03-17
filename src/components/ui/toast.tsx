'use client';

import { Toaster as Sonner } from 'sonner';

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:bg-white group-[.toaster]:text-[#0B0F1A] group-[.toaster]:border-[#0B0F1A]/10 group-[.toaster]:shadow-lg group-[.toaster]:font-[Syne]',
          description: 'group-[.toast]:text-[#0B0F1A]/60',
          actionButton:
            'group-[.toast]:bg-[#0B0F1A] group-[.toast]:text-white',
          cancelButton:
            'group-[.toast]:bg-[#0B0F1A]/5 group-[.toast]:text-[#0B0F1A]/60',
          success:
            'group-[.toaster]:border-emerald-500/20 group-[.toaster]:text-emerald-600',
          error:
            'group-[.toaster]:border-red-500/20 group-[.toaster]:text-red-600',
          warning:
            'group-[.toaster]:border-amber-500/20 group-[.toaster]:text-amber-600',
          info:
            'group-[.toaster]:border-[#4B9EFF]/20 group-[.toaster]:text-[#4B9EFF]',
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
