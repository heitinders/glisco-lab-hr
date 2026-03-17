'use client';

import { useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import {
  LayoutDashboard,
  Users,
  Calendar,
  Clock,
  DollarSign,
  Award,
  UserPlus,
  FileText,
  GitBranch,
  BarChart3,
  Settings,
  Bot,
  X,
  LogOut,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/* ── Navigation items (mirrored from sidebar) ───────────────────────── */

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard },
  { label: 'Employees', href: '/employees', icon: Users },
  { label: 'Leave', href: '/leave', icon: Calendar },
  { label: 'Attendance', href: '/attendance', icon: Clock },
  { label: 'Payroll', href: '/payroll', icon: DollarSign },
  { label: 'Performance', href: '/performance', icon: Award },
  { label: 'Recruitment', href: '/recruitment', icon: UserPlus },
  { label: 'Documents', href: '/documents', icon: FileText },
  { label: 'Org Chart', href: '/org-chart', icon: GitBranch },
  { label: 'Reports', href: '/reports', icon: BarChart3 },
  { label: 'AI Assistant', href: '/ai-assistant', icon: Bot },
  { label: 'Settings', href: '/settings', icon: Settings },
];

/* ── MobileSidebar component ─────────────────────────────────────────── */

interface MobileSidebarProps {
  open: boolean;
  onClose: () => void;
}

export function MobileSidebar({ open, onClose }: MobileSidebarProps) {
  const pathname = usePathname();

  /* Close on route change */
  useEffect(() => {
    onClose();
  }, [pathname, onClose]);

  /* Close on Escape */
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [open, handleKeyDown]);

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-navy/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <aside className="animate-slide-in-left fixed inset-y-0 left-0 flex w-72 flex-col bg-navy text-white shadow-2xl">
        {/* Header */}
        <div className="flex h-16 items-center justify-between border-b border-white/5 px-5">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-blue">
              <span className="font-heading text-base text-white">G</span>
              <div className="absolute -right-0.5 top-0.5 h-4 w-0.5 rotate-12 bg-white/60" />
            </div>
            <span className="font-heading text-xl tracking-tight text-white">
              GliscoHR
            </span>
          </Link>
          <button
            onClick={onClose}
            className="focus-ring rounded-lg p-1.5 text-white/40 transition-colors hover:text-white"
            aria-label="Close navigation"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Mobile navigation">
          <ul className="space-y-1" role="list">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      'focus-ring relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                      active
                        ? 'bg-blue/10 text-blue'
                        : 'text-white/60 hover:bg-white/5 hover:text-white'
                    )}
                    aria-current={active ? 'page' : undefined}
                  >
                    {active && (
                      <div className="absolute left-0 top-1/2 h-6 w-0.5 -translate-y-1/2 rounded-r-full bg-blue" />
                    )}
                    <Icon
                      className={cn(
                        'h-5 w-5 flex-shrink-0',
                        active ? 'text-blue' : 'text-white/40'
                      )}
                    />
                    <span>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* User section */}
        <div className="border-t border-white/5 p-3">
          <div className="flex items-center gap-3 rounded-lg p-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue/20 text-sm font-semibold text-blue">
              HS
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">
                Heitinder Singh
              </p>
              <p className="truncate text-xs text-white/50">Admin</p>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="focus-ring rounded p-1 text-white/40 transition-colors hover:text-white"
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}

export default MobileSidebar;
