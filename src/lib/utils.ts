import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', {
    style: 'currency',
    currency,
  }).format(amount);
}

export function formatDate(date: Date | string, format: 'short' | 'long' | 'iso' = 'short'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  switch (format) {
    case 'long':
      return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    case 'iso':
      return d.toISOString().split('T')[0];
    default:
      return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }
}

export function generateEmployeeId(lastId: string | null): string {
  if (!lastId) return 'GL-001';
  const num = parseInt(lastId.replace('GL-', ''), 10);
  return `GL-${String(num + 1).padStart(3, '0')}`;
}

export function maskSensitive(value: string | null | undefined, visibleChars: number = 4): string {
  if (!value) return '';
  if (value.length <= visibleChars) return value;
  return 'X'.repeat(value.length - visibleChars) + value.slice(-visibleChars);
}

export function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}
