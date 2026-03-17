import type { Metadata } from 'next';
import { DM_Serif_Display, Syne, DM_Mono } from 'next/font/google';
import { Providers } from '@/components/providers';
import './globals.css';

const dmSerifDisplay = DM_Serif_Display({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-heading',
  display: 'swap',
});

const syne = Syne({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
});

const dmMono = DM_Mono({
  weight: ['300', '400', '500'],
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'GliscoHR',
    template: '%s | GliscoHR',
  },
  description:
    'Enterprise HR platform by Glisco Lab. Manage employees, payroll, leave, attendance, performance, and recruitment in one place.',
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${dmSerifDisplay.variable} ${syne.variable} ${dmMono.variable} font-body antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
