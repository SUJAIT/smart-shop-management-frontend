'use client';
import { tr } from '@/lib/lang';
import { useQuery } from '@tanstack/react-query';
import { Smartphone } from 'lucide-react';
import { Field } from '@/components/common';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { useDebounced } from '@/lib/hooks';
import { cleanImei, imeiClash, imeiState, luhnOk } from '@/lib/imei';
import type { Row } from '@/lib/types';
import { cn } from '@/lib/utils';

/**
 * One IMEI box: all 15 digits, or only the last 4.
 * While typing it says right away if the number is already in another box of this form (`others`)
 * or already on another phone of the shop (`ignoreId` = the phone being edited). The server checks again when saving.
 */
export function ImeiInput({ value, onChange, label, ariaLabel, autoFocus, others = [], ignoreId }: {
  value: string; onChange: (v: string) => void; label?: string; ariaLabel?: string; autoFocus?: boolean; others?: string[]; ignoreId?: string;
}) {
  const st = imeiState(value);
  const valid = st === 'full' || st === 'last4';
  const inForm = valid && others.some((o) => imeiClash(value, o));
  const dv = useDebounced(valid ? value : '', 350);
  const { data: hits } = useQuery({ queryKey: ['imei-check', dv], enabled: !!dv, retry: false, staleTime: 5_000, queryFn: () => api<Row[]>(`/products/imei/${dv}`) });
  const used = dv && dv === value && !inForm ? hits?.find((h) => h._id !== ignoreId) : undefined;
  const bad = st === 'partial' || inForm || !!used;

  const status = (() => {
    if (st === 'empty') return null;
    if (st === 'partial') return <p className="num text-xs text-danger">{tr('{n}/15 digits. Enter all 15, or just the last 4.', { n: value.length })}</p>;
    if (inForm) return <p className="text-xs text-danger">{tr('This number is already entered in another box.')}</p>;
    if (used) return <p className="text-xs text-danger">{tr('Already used by “{name}”', { name: used.name })}</p>;
    if (st === 'last4') return <p className="text-xs text-success">{tr('Last 4 digits')}</p>;
    return luhnOk(value)
      ? <p className="text-xs text-success">{tr('Full IMEI')}</p>
      : <p className="text-xs text-warning">{tr('Check digit does not match. Please double check the number.')}</p>;
  })();

  const input = (
    <Input
      value={value}
      onChange={(e) => onChange(cleanImei(e.target.value))}
      inputMode="numeric"
      maxLength={15}
      placeholder={tr('15 digits or last 4')}
      aria-label={ariaLabel ?? label}
      aria-invalid={bad}
      autoFocus={autoFocus}
      className={cn('num', bad && 'border-danger ring-1 ring-danger')}
    />
  );
  return label ? <Field label={label}>{input}{status}</Field> : <div className="space-y-1">{input}{status}</div>;
}

const Intro = ({ title }: { title: string }) => (
  <div className="flex items-start justify-between gap-3">
    <div className="flex min-w-0 items-start gap-2.5">
      <Smartphone className="mt-0.5 size-5 shrink-0 text-primary" />
      <div className="min-w-0">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-[13px] text-muted-foreground">{tr('Add the IMEI to find this phone later for warranty and service. Type all 15 digits, or just the last 4. Dial *#06# on the phone to see them.')}</p>
        <p className="mt-1 text-[13px] text-muted-foreground">{tr('Each IMEI, or last 4 digits, can be used on only one phone.')}</p>
      </div>
    </div>
    <Badge tone="primary" className="shrink-0">{tr('Recommended')}</Badge>
  </div>
);

/** "Your phone" card: IMEI is recommended, never required. One IMEI is enough. */
export function ImeiSection({ imei1, imei2, onChange, ignoreId }: { imei1: string; imei2: string; onChange: (k: 'imei1' | 'imei2', v: string) => void; ignoreId?: string }) {
  return (
    <div className="space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
      <Intro title={tr('Your phone')} />
      <div className="grid gap-3 sm:grid-cols-2">
        <ImeiInput label={tr('IMEI 1')} value={imei1} onChange={(v) => onChange('imei1', v)} others={[imei2]} ignoreId={ignoreId} />
        <ImeiInput label={tr('IMEI 2')} value={imei2} onChange={(v) => onChange('imei2', v)} others={[imei1]} ignoreId={ignoreId} />
      </div>
      <p className="text-xs text-muted-foreground">{tr('One IMEI is enough. The second is optional.')}</p>
    </div>
  );
}

/** Adding several phones at once: one pair of IMEI boxes for each phone, and no number may repeat between them. */
export function ImeiRows({ count, rows, onChange }: { count: number; rows: string[][]; onChange: (i: number, k: 0 | 1, v: string) => void }) {
  const othersOf = (i: number, k: 0 | 1) =>
    Array.from({ length: count }).flatMap((_, ri) => ([0, 1] as const).filter((ki) => !(ri === i && ki === k)).map((ki) => rows[ri]?.[ki] ?? ''));
  return (
    <div className="space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
      <Intro title={tr('Your phones')} />
      {count <= 30 ? (
        <div className="space-y-2">
          {Array.from({ length: count }).map((_, i) => (
            <div key={i} className="grid grid-cols-[1.5rem_1fr_1fr] items-start gap-2">
              <span className="num pt-2 text-sm text-muted-foreground">{i + 1}</span>
              <ImeiInput value={rows[i]?.[0] ?? ''} onChange={(v) => onChange(i, 0, v)} others={othersOf(i, 0)} ariaLabel={`${tr('Phone')} ${i + 1} ${tr('IMEI 1')}`} />
              <ImeiInput value={rows[i]?.[1] ?? ''} onChange={(v) => onChange(i, 1, v)} others={othersOf(i, 1)} ariaLabel={`${tr('Phone')} ${i + 1} ${tr('IMEI 2')}`} />
            </div>
          ))}
        </div>
      ) : <p className="text-sm text-muted-foreground">{tr('For more than 30 phones, add the IMEI later by editing each phone.')}</p>}
    </div>
  );
}
