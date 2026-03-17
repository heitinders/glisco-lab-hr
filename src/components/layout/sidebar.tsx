'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
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
  ChevronsLeft,
  ChevronsRight,
  LogOut,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/* ── Navigation items ────────────────────────────────────────────────── */

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
];

const BOTTOM_NAV_ITEMS: NavItem[] = [
  { label: 'AI Assistant', href: '/ai-assistant', icon: Bot },
  { label: 'Settings', href: '/settings', icon: Settings },
];

/* ── Sidebar component ───────────────────────────────────────────────── */

interface SidebarProps {
  className?: string;
}

export function Sidebar({ className }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => !prev);
  }, []);

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  return (
    <aside
      className={cn(
        'sidebar-transition fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-white/5 bg-navy text-white',
        collapsed ? 'w-[72px]' : 'w-[260px]',
        'hidden lg:flex',
        className
      )}
      role="navigation"
      aria-label="Main navigation"
    >
      {/* Logo area */}
      <div
        className={cn(
          'flex h-16 items-center border-b border-white/5',
          collapsed ? 'justify-center px-2' : 'px-5'
        )}
      >
        <Link href="/" className="flex items-center gap-2.5 focus-ring rounded">
          {/* Slash motif mark */}
          <div className="relative flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-blue">
            <span className="font-heading text-base font-normal text-white">G</span>
            <div className="absolute -right-0.5 top-0.5 h-4 w-0.5 rotate-12 bg-white/60" />
          </div>
          {!collapsed && (
            <span className="font-heading text-xl tracking-tight text-white">
              GliscoHR
            </span>
          )}
        </Link>
      </div>

      {/* Main navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Primary">
        <ul className="space-y-1" role="list">
          {NAV_ITEMS.map((item) => (
            <li key={item.href}>
              <NavLink item={item} active={isActive(item.href)} collapsed={collapsed} />
            </li>
          ))}
        </ul>
      </nav>

      {/* Bottom section */}
      <div className="border-t border-white/5 px-3 py-3">
        <ul className="space-y-1" role="list">
          {BOTTOM_NAV_ITEMS.map((item) => (
            <li key={item.href}>
              <NavLink item={item} active={isActive(item.href)} collapsed={collapsed} />
            </li>
          ))}
        </ul>
      </div>

      {/* User section */}
      <div
        className={cn(
          'border-t border-white/5 p-3',
          collapsed ? 'flex justify-center' : ''
        )}
      >
        <div
          className={cn(
            'flex items-center gap-3 rounded-lg p-2',
            collapsed ? 'justify-center' : ''
          )}
        >
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-blue/20 text-sm font-semibold text-blue">
            HS
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">
                Heitinder Singh
              </p>
              <p className="truncate text-xs text-white/50">Admin</p>
            </div>
          )}
          {!collapsed && (
            <button
              className="focus-ring rounded p-1 text-white/40 transition-colors hover:text-white"
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Collapse toggle */}
      <div className="border-t border-white/5 p-2">
        <button
          onClick={toggleCollapsed}
          className={cn(
            'focus-ring flex w-full items-center justify-center rounded-lg p-2 text-white/40 transition-colors hover:bg-white/5 hover:text-white'
          )}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <ChevronsRight className="h-4 w-4" />
          ) : (
            <ChevronsLeft className="h-4 w-4" />
          )}
        </button>
      </div>
    </aside>
  );
}

/* ── NavLink sub-component ───────────────────────────────────────────── */

interface NavLinkProps {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
}

function NavLink({ item, active, collapsed }: NavLinkProps) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      className={cn(
        'focus-ring group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150',
        collapsed ? 'justify-center px-2' : '',
        active
          ? 'bg-blue/10 text-blue'
          : 'text-white/60 hover:bg-white/5 hover:text-white'
      )}
      aria-current={active ? 'page' : undefined}
      title={collapsed ? item.label : undefined}
    >
      {/* Active indicator bar */}
      {active && (
        <div className="absolute left-0 top-1/2 h-6 w-0.5 -translate-y-1/2 rounded-r-full bg-blue" />
      )}

      <Icon
        className={cn(
          'h-5 w-5 flex-shrink-0 transition-colors',
          active ? 'text-blue' : 'text-white/40 group-hover:text-white/70'
        )}
      />

      {!collapsed && <span className="truncate">{item.label}</span>}

      {/* Tooltip for collapsed mode */}
      {collapsed && (
        <div className="pointer-events-none absolute left-full ml-2 hidden rounded-md bg-navy-light px-2.5 py-1.5 text-xs font-medium text-white shadow-lg group-hover:block">
          {item.label}
          <div className="absolute -left-1 top-1/2 h-2 w-2 -translate-y-1/2 rotate-45 bg-navy-light" />
        </div>
      )}
    </Link>
  );
}

export default Sidebar;
