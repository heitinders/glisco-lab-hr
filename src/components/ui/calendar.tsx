'use client';

import * as React from 'react';
import {
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  isSameMonth,
  isSameDay,
  isToday,
  format,
} from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export interface CalendarProps {
  selected?: Date;
  onSelect?: (date: Date) => void;
  disabled?: (date: Date) => boolean;
  className?: string;
  minDate?: Date;
  maxDate?: Date;
}

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const Calendar = React.forwardRef<HTMLDivElement, CalendarProps>(
  ({ selected, onSelect, disabled, className, minDate, maxDate }, ref) => {
    const [currentMonth, setCurrentMonth] = React.useState(
      selected ? startOfMonth(selected) : startOfMonth(new Date())
    );

    const handlePreviousMonth = () => {
      setCurrentMonth((prev) => subMonths(prev, 1));
    };

    const handleNextMonth = () => {
      setCurrentMonth((prev) => addMonths(prev, 1));
    };

    const handleSelectDate = (date: Date) => {
      if (disabled?.(date)) return;
      if (minDate && date < minDate) return;
      if (maxDate && date > maxDate) return;
      onSelect?.(date);
    };

    const renderDays = () => {
      const monthStart = startOfMonth(currentMonth);
      const monthEnd = endOfMonth(monthStart);
      const calStart = startOfWeek(monthStart);
      const calEnd = endOfWeek(monthEnd);

      const days: React.ReactNode[] = [];
      let day = calStart;

      while (day <= calEnd) {
        const currentDay = day;
        const isCurrentMonth = isSameMonth(currentDay, currentMonth);
        const isSelected = selected ? isSameDay(currentDay, selected) : false;
        const isCurrentDay = isToday(currentDay);
        const isDisabled =
          disabled?.(currentDay) ||
          (minDate !== undefined && currentDay < minDate) ||
          (maxDate !== undefined && currentDay > maxDate);

        days.push(
          <button
            key={currentDay.toISOString()}
            type="button"
            onClick={() => handleSelectDate(currentDay)}
            disabled={!!isDisabled}
            className={cn(
              'inline-flex h-9 w-9 items-center justify-center rounded-md text-sm font-[Syne] transition-colors',
              'hover:bg-[#4B9EFF]/10 hover:text-[#0B0F1A]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4B9EFF]',
              !isCurrentMonth && 'text-[#0B0F1A]/30',
              isCurrentMonth && 'text-[#0B0F1A]',
              isCurrentDay && !isSelected && 'bg-[#0B0F1A]/5 font-semibold',
              isSelected &&
                'bg-[#0B0F1A] text-white hover:bg-[#0B0F1A]/90 hover:text-white',
              isDisabled && 'pointer-events-none opacity-50'
            )}
          >
            {format(currentDay, 'd')}
          </button>
        );
        day = addDays(day, 1);
      }

      return days;
    };

    return (
      <div ref={ref} className={cn('p-3', className)}>
        <div className="flex items-center justify-between mb-4">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handlePreviousMonth}
            type="button"
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="sr-only">Previous month</span>
          </Button>
          <h2 className="text-sm font-semibold font-[Syne] text-[#0B0F1A]">
            {format(currentMonth, 'MMMM yyyy')}
          </h2>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleNextMonth}
            type="button"
          >
            <ChevronRight className="h-4 w-4" />
            <span className="sr-only">Next month</span>
          </Button>
        </div>

        <div className="grid grid-cols-7 gap-1 mb-1">
          {WEEKDAYS.map((weekday) => (
            <div
              key={weekday}
              className="flex h-9 w-9 items-center justify-center text-xs font-medium font-[Syne] text-[#0B0F1A]/50"
            >
              {weekday}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">{renderDays()}</div>
      </div>
    );
  }
);
Calendar.displayName = 'Calendar';

export { Calendar };
