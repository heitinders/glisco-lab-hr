'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { signOut, useSession } from 'next-auth/react';
import {
  Menu,
  User,
  Settings,
  LogOut,
  ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { NotificationBell } from '@/components/layout/notification-bell';

/* ── Helpers ─────────────────────────────────────────────────────────── */

function getInitials(name?: string | null) {
  if (!name) return '??';
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/* ── Types ───────────────────────────────────────────────────────────── */

interface TopbarProps {
  onMenuToggle?: () => void;
  className?: string;
}

/* ── Topbar component ────────────────────────────────────────────────── */

export function Topbar({ onMenuToggle, className }: TopbarProps) {
  const { data: session } = useSession();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const userName = session?.user?.name ?? 'User';
  const userEmail = session?.user?.email ?? '';
  const initials = getInitials(userName);

  /* Close dropdown on outside click */
  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
      setUserMenuOpen(false);
    }
  }, []);

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [handleClickOutside]);

  return (
    <header
      className={cn(
        'sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-white px-4 lg:px-6',
        className
      )}
      role="banner"
    >
      {/* Left: mobile menu + breadcrumbs */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuToggle}
          className="focus-ring rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:hidden"
          aria-label="Toggle navigation menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        <Breadcrumbs />
      </div>

      {/* Right: notifications + user menu */}
      <div className="flex items-center gap-2">
        {/* Notifications */}
        <NotificationBell />

        {/* Separator */}
        <div className="mx-1 h-6 w-px bg-border" role="separator" />

        {/* User menu */}
        <div ref={userMenuRef} className="relative">
          <button
            onClick={() => setUserMenuOpen((prev) => !prev)}
            className="focus-ring flex items-center gap-2 rounded-lg p-1.5 transition-colors hover:bg-muted"
            aria-label="User menu"
            aria-expanded={userMenuOpen}
            aria-haspopup="true"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-navy text-xs font-semibold text-white">
              {initials}
            </div>
            <span className="hidden text-sm font-medium text-foreground md:inline-block">
              {userName.split(' ')[0]}
            </span>
            <ChevronDown
              className={cn(
                'hidden h-4 w-4 text-muted-foreground transition-transform md:inline-block',
                userMenuOpen && 'rotate-180'
              )}
            />
          </button>

          {/* User dropdown */}
          {userMenuOpen && (
            <div
              className="animate-fade-in absolute right-0 top-full mt-2 w-56 rounded-xl border border-border bg-white py-1 shadow-lg"
              role="menu"
              aria-label="User options"
            >
              <div className="border-b border-border px-4 py-3">
                <p className="text-sm font-semibold text-foreground">
                  {userName}
                </p>
                <p className="text-xs text-muted-foreground">{userEmail}</p>
              </div>
              <div className="py-1">
                <UserMenuItem
                  href="/settings"
                  icon={User}
                  label="Profile"
                />
                <UserMenuItem
                  href="/settings"
                  icon={Settings}
                  label="Settings"
                />
              </div>
              <div className="border-t border-border py-1">
                <button
                  onClick={() => signOut({ callbackUrl: '/login' })}
                  className="flex w-full items-center gap-3 px-4 py-2 text-sm text-error transition-colors hover:bg-error-light"
                  role="menuitem"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Sign out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

/* ── UserMenuItem sub-component ──────────────────────────────────────── */

interface UserMenuItemProps {
  href: string;
  icon: React.ElementType;
  label: string;
}

function UserMenuItem({ href, icon: Icon, label }: UserMenuItemProps) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-4 py-2 text-sm text-foreground transition-colors hover:bg-muted"
      role="menuitem"
    >
      <Icon className="h-4 w-4 text-muted-foreground" />
      <span>{label}</span>
    </Link>
  );
}

export default Topbar;
