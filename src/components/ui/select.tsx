import React, { forwardRef, type SelectHTMLAttributes } from 'react';
import { Label } from './label';
import { cn } from '../../lib/utils';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, children, id, ...props }, ref) => {
    const selectId = id || React.useId();

    return (
      <div className="space-y-2 w-full">
        {label && <Label htmlFor={selectId}>{label}</Label>}
        <div className="relative">
          <select
            id={selectId}
            ref={ref}
            className={cn(
              'h-11 w-full appearance-none rounded-md border border-border bg-white px-3 py-2 text-base outline-none transition-colors md:h-10 md:text-sm',
              'focus:border-primary focus:ring-2 focus:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50',
              error && 'border-destructive focus:border-destructive focus:ring-destructive/30',
              className
            )}
            {...props}
          >
            {children}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-muted-foreground">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
            </svg>
          </div>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    );
  }
);
Select.displayName = 'Select';
