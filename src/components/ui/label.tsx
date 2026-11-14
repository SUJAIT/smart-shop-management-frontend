'use client';
import * as L from '@radix-ui/react-label';
import * as React from 'react';
import { cn } from '@/lib/utils';

export const Label = React.forwardRef<HTMLLabelElement, React.ComponentPropsWithoutRef<typeof L.Root>>(({ className, ...p }, ref) => (
  <L.Root ref={ref} className={cn('text-[13px] font-medium', className)} {...p} />
));
Label.displayName = 'Label';
