'use client';

import Link from 'next/link';
import {
  Building2,
  Shield,
  Users,
  Plug,
  ScrollText,
} from 'lucide-react';

const SETTINGS_SECTIONS = [
  {
    title: 'Company Profile',
    description: 'Manage company name, logo, address, timezone, and fiscal year settings',
    href: '/settings/company',
    icon: Building2,
  },
  {
    title: 'Compliance',
    description: 'Configure region-specific compliance settings for US (NJ) and India (PF, ESI, TDS)',
    href: '/settings/compliance',
    icon: Shield,
  },
  {
    title: 'Roles & Permissions',
    description: 'View and manage user roles and access control',
    href: '/settings/roles',
    icon: Users,
  },
  {
    title: 'Audit Log',
    description: 'View a detailed log of all system changes and user actions',
    href: '/settings/audit-log',
    icon: ScrollText,
  },
  {
    title: 'Integrations',
    description: 'Connect third-party services and configure API keys',
    href: '/settings/integrations',
    icon: Plug,
  },
];

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="font-heading text-2xl text-foreground sm:text-3xl">
          Settings
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure your GliscoHR platform
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {SETTINGS_SECTIONS.map((section) => (
          <Link key={section.href} href={section.href}>
            <div className="rounded-lg border p-5 transition-colors hover:bg-muted/30">
              <div className="flex items-start gap-4">
                <div className="rounded-lg bg-muted p-2.5">
                  <section.icon className="h-5 w-5 text-foreground" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">{section.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{section.description}</p>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
