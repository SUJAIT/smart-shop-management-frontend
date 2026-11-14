'use client';
import * as T from '@radix-ui/react-tabs';
import * as React from 'react';
import { cn } from '@/lib/utils';

export const Tabs = T.Root;
export const TabsList = React.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<typeof T.List>>(({ className, ...p }, ref) => (
  <T.List ref={ref} className={cn('flex gap-1 overflow-x-auto border-b', className)} {...p} />
));
TabsList.displayName = 'TabsList';
export const TabsTrigger = React.forwardRef<HTMLButtonElement, React.ComponentPropsWithoutRef<typeof T.Trigger>>(({ className, ...p }, ref) => (
  <T.Trigger
    ref={ref}
    className={cn(
      '-mb-px whitespace-nowrap border-b-2 border-transparent px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-foreground',
      className,
    )}
    {...p}
  />
));
TabsTrigger.displayName = 'TabsTrigger';
export const TabsContent = T.Content;
