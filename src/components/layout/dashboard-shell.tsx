'use client';

import { useState, useCallback } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { MobileNav } from '@/components/layout/mobile-nav';
import { MobileSidebar } from '@/components/layout/mobile-sidebar';

/* ── DashboardShell ──────────────────────────────────────────────────── */

interface DashboardShellProps {
  children: React.ReactNode;
}

export function DashboardShell({ children }: DashboardShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleMenuToggle = useCallback(() => {
    setMobileMenuOpen((prev) => !prev);
  }, []);

  const handleMenuClose = useCallback(() => {
    setMobileMenuOpen(false);
  }, []);

  return (
    <div className="relative min-h-screen bg-background">
      {/* Desktop sidebar */}
      <Sidebar />

      {/* Mobile sidebar drawer */}
      <MobileSidebar open={mobileMenuOpen} onClose={handleMenuClose} />

      {/* Main content area - offset by sidebar width on desktop */}
      <div className="flex min-h-screen flex-col lg:pl-[260px]">
        {/* Top bar */}
        <Topbar onMenuToggle={handleMenuToggle} />

        {/* Page content */}
        <main
          className="flex-1 px-4 py-6 pb-20 lg:px-8 lg:pb-8"
          id="main-content"
          role="main"
        >
          {children}
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <MobileNav />
    </div>
  );
}

export default DashboardShell;
