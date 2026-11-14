'use client';
import * as S from '@radix-ui/react-switch';
import * as React from 'react';
import { cn } from '@/lib/utils';

export const Switch = React.forwardRef<HTMLButtonElement, React.ComponentPropsWithoutRef<typeof S.Root>>(({ className, ...p }, ref) => (
  <S.Root
    ref={ref}
    className={cn('inline-flex h-6 w-11 shrink-0 items-center rounded-full bg-input transition-colors data-[state=checked]:bg-primary disabled:opacity-50', className)}
    {...p}
  >
    <S.Thumb className="block size-5 translate-x-0.5 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-[22px]" />
  </S.Root>
));
Switch.displayName = 'Switch';
