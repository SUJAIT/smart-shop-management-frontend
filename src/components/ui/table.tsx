'use client';
import * as React from 'react';
import { cn } from '@/lib/utils';

/** On phones the rows become cards. The small labels are copied from the column headings, so pages need no extra work. */
export const Table = ({ className, children, ...p }: React.TableHTMLAttributes<HTMLTableElement>) => {
  const ref = React.useRef<HTMLTableElement>(null);
  React.useEffect(() => {
    const t = ref.current;
    if (!t) return;
    const heads = (Array.from(t.querySelectorAll('thead th')) as HTMLElement[]).map((h) => h.textContent?.trim() ?? '');
    t.querySelectorAll('tbody tr').forEach((tr) =>
      Array.from(tr.children).forEach((td, i) => ((td as HTMLElement).dataset.label = heads[i] ?? '')),
    );
  });
  return (
    <div className="w-full overflow-x-auto">
      <table ref={ref} className={cn('rtable w-full text-sm', className)} {...p}>
        {children}
      </table>
    </div>
  );
};
export const THead = (p: React.HTMLAttributes<HTMLTableSectionElement>) => <thead className="border-b bg-muted/50 text-left text-[13px] text-muted-foreground" {...p} />;
export const TBody = (p: React.HTMLAttributes<HTMLTableSectionElement>) => <tbody className="divide-y" {...p} />;
export const TR = ({ className, ...p }: React.HTMLAttributes<HTMLTableRowElement>) => <tr className={cn('hover:bg-muted/40', className)} {...p} />;
export const TH = ({ className, ...p }: React.ThHTMLAttributes<HTMLTableCellElement>) => <th className={cn('whitespace-nowrap px-4 py-2.5 font-medium', className)} {...p} />;
export const TD = ({ className, ...p }: React.TdHTMLAttributes<HTMLTableCellElement>) => <td className={cn('px-4 py-3 align-middle', className)} {...p} />;
