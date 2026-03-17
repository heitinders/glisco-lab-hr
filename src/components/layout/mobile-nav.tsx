'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Calendar,
  DollarSign,
  MoreHorizontal,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/* ── Mobile tab items ────────────────────────────────────────────────── */

interface MobileTab {
  label: string;
  href: string;
  icon: React.ElementType;
}

const MOBILE_TABS: MobileTab[] = [
  { label: 'Home', href: '/', icon: LayoutDashboard },
  { label: 'People', href: '/employees', icon: Users },
  { label: 'Leave', href: '/leave', icon: Calendar },
  { label: 'Payroll', href: '/payroll', icon: DollarSign },
  { label: 'More', href: '/settings', icon: MoreHorizontal },
];

/* ── MobileNav component ─────────────────────────────────────────────── */

interface MobileNavProps {
  className?: string;
}

export function MobileNav({ className }: MobileNavProps) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  return (
    <nav
      className={cn(
        'fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-white lg:hidden',
        className
      )}
      role="navigation"
      aria-label="Mobile navigation"
    >
      <div className="flex h-16 items-stretch">
        {MOBILE_TABS.map((tab) => {
          const Icon = tab.icon;
          const active = isActive(tab.href);

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                'focus-ring relative flex flex-1 flex-col items-center justify-center gap-1 text-xs font-medium transition-colors',
                active
                  ? 'text-blue'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              aria-current={active ? 'page' : undefined}
            >
              {/* Active top indicator */}
              {active && (
                <div className="absolute left-1/2 top-0 h-0.5 w-8 -translate-x-1/2 rounded-b-full bg-blue" />
              )}

              <Icon
                className={cn(
                  'h-5 w-5',
                  active ? 'text-blue' : 'text-muted-foreground'
                )}
              />
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </div>

      {/* Safe area spacing for iOS */}
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}

export default MobileNav;
