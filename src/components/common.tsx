'use client';
import { tr } from '@/lib/lang';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { PROVIDER_COLOR } from '@/lib/labels';
import type { Meta } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Button } from './ui/button';
import { Modal } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Skeleton } from './ui/skeleton';

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ icon, title, hint, action }: { icon?: ReactNode; title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
      {icon && <div className="mb-1 text-muted-foreground [&_svg]:size-8">{icon}</div>}
      <p className="font-medium">{title}</p>
      {hint && <p className="max-w-sm text-sm text-muted-foreground">{hint}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Field({ label, hint, className, children }: { label: string; hint?: string; className?: string; children: ReactNode }) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function SearchBox({ value, onChange, placeholder = 'Search' }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative w-full sm:w-72">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="pl-9" />
    </div>
  );
}

export function Pager({ meta, onPage }: { meta?: Meta; onPage: (p: number) => void }) {
  if (!meta || meta.totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between border-t px-4 py-3 text-sm text-muted-foreground">
      <span className="num">
        {tr("Page")} {meta.page} {tr("of")} {meta.totalPages} · {meta.total} {tr("items")}
      </span>
      <div className="flex gap-1">
        <Button size="icon" variant="outline" disabled={meta.page <= 1} onClick={() => onPage(meta.page - 1)} aria-label={tr("Previous page")}>
          <ChevronLeft />
        </Button>
        <Button size="icon" variant="outline" disabled={meta.page >= meta.totalPages} onClick={() => onPage(meta.page + 1)} aria-label={tr("Next page")}>
          <ChevronRight />
        </Button>
      </div>
    </div>
  );
}

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-11 w-full" />
      ))}
    </div>
  );
}

/** Strong delete: the user must type the exact name before the button unlocks. */
export function ConfirmNameDialog({
  open,
  onOpenChange,
  name,
  title,
  description,
  loading,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  name: string;
  title: string;
  description: string;
  loading?: boolean;
  onConfirm: (typed: string) => void;
}) {
  const [typed, setTyped] = useState('');
  return (
    <Modal
      open={open}
      onOpenChange={(o) => {
        if (!o) setTyped('');
        onOpenChange(o);
      }}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {tr("Keep it")}
          </Button>
          <Button variant="danger" disabled={typed.trim() !== name} loading={loading} onClick={() => onConfirm(typed.trim())}>
            {tr("Delete")}
          </Button>
        </>
      }
    >
      <Field label={tr('Type “{name}” to confirm', { name })}>
        <Input value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus />
      </Field>
    </Modal>
  );
}

/** Operators and MFS providers: a coloured mark with the first letter (swap for real logos by key anytime). */
export function ProviderMark({ k, name, size = 28 }: { k?: string; name?: string; size?: number }) {
  const key = (k ?? name ?? '').toLowerCase();
  return (
    <span
      className="inline-grid shrink-0 place-items-center rounded-full font-semibold text-white"
      style={{ width: size, height: size, background: PROVIDER_COLOR[key] ?? '#5B6B7F', fontSize: size * 0.45 }}
      aria-hidden
    >
      {(name ?? k ?? '?')[0]?.toUpperCase()}
    </span>
  );
}

export function Kpi({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'success' | 'danger' | 'warning' }) {
  return (
    <div className="min-w-0">
      <p className="text-[13px] text-muted-foreground">{label}</p>
      <p className={cn('num mt-0.5 truncate text-xl font-semibold sm:text-2xl', tone === 'success' && 'text-success', tone === 'danger' && 'text-danger', tone === 'warning' && 'text-warning')}>{value}</p>
      {sub && <p className="num mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

export const chartColor = (n: number) => `rgb(var(--chart-${((n - 1) % 6) + 1}))`;
