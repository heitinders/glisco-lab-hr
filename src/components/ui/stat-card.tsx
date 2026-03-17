'use client';

import * as React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon?: React.ReactNode;
  loading?: boolean;
}

const StatCard = React.forwardRef<HTMLDivElement, StatCardProps>(
  (
    { className, title, value, change, changeLabel, icon, loading = false, ...props },
    ref
  ) => {
    const isPositive = change !== undefined && change >= 0;

    if (loading) {
      return (
        <Card ref={ref} className={cn('', className)} {...props}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="h-4 w-24 animate-pulse rounded bg-[#0B0F1A]/10" />
            <div className="h-8 w-8 animate-pulse rounded bg-[#0B0F1A]/10" />
          </CardHeader>
          <CardContent>
            <div className="h-8 w-32 animate-pulse rounded bg-[#0B0F1A]/10" />
            <div className="mt-2 h-3 w-20 animate-pulse rounded bg-[#0B0F1A]/10" />
          </CardContent>
        </Card>
      );
    }

    return (
      <Card ref={ref} className={cn('', className)} {...props}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium font-[Syne] text-[#0B0F1A]/60">
            {title}
          </CardTitle>
          {icon && (
            <div className="text-[#4B9EFF]">
              {icon}
            </div>
          )}
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold font-[\"DM_Serif_Display\"] text-[#0B0F1A]">
            {value}
          </div>
          {change !== undefined && (
            <p className="mt-1 flex items-center gap-1 text-xs font-[Syne]">
              {isPositive ? (
                <TrendingUp className="h-3 w-3 text-emerald-500" />
              ) : (
                <TrendingDown className="h-3 w-3 text-red-500" />
              )}
              <span
                className={cn(
                  'font-medium',
                  isPositive ? 'text-emerald-500' : 'text-red-500'
                )}
              >
                {isPositive ? '+' : ''}
                {change}%
              </span>
              {changeLabel && (
                <span className="text-[#0B0F1A]/50">{changeLabel}</span>
              )}
            </p>
          )}
        </CardContent>
      </Card>
    );
  }
);
StatCard.displayName = 'StatCard';

export { StatCard };
