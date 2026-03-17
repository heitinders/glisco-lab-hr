'use client';

import * as React from 'react';
import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar, type CalendarProps } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

export interface DatePickerProps
  extends Omit<CalendarProps, 'className'> {
  placeholder?: string;
  className?: string;
  formatStr?: string;
}

const DatePicker = React.forwardRef<HTMLButtonElement, DatePickerProps>(
  (
    {
      selected,
      onSelect,
      disabled,
      placeholder = 'Pick a date',
      className,
      formatStr = 'PPP',
      minDate,
      maxDate,
    },
    ref
  ) => {
    const [open, setOpen] = React.useState(false);

    const handleSelect = (date: Date) => {
      onSelect?.(date);
      setOpen(false);
    };

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            ref={ref}
            variant="outline"
            className={cn(
              'w-full justify-start text-left font-normal font-[Syne]',
              !selected && 'text-[#0B0F1A]/50',
              className
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {selected ? format(selected, formatStr) : placeholder}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            selected={selected}
            onSelect={handleSelect}
            disabled={disabled}
            minDate={minDate}
            maxDate={maxDate}
          />
        </PopoverContent>
      </Popover>
    );
  }
);
DatePicker.displayName = 'DatePicker';

export { DatePicker };
