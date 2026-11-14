'use client';
import { tr } from '@/lib/lang';
import { useQuery } from '@tanstack/react-query';
import { Pencil, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Field, ListSkeleton, PageHeader } from '@/components/common';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Modal } from '@/components/ui/dialog';
import { Input, Textarea } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useAct } from '@/lib/hooks';
import type { Row } from '@/lib/types';
import { fromPaisa, num, taka, toPaisa } from '@/lib/utils';

export default function PlansPage() {
  const { can } = useAuth();
  const manage = can('plan.manage');
  const { data, isLoading } = useQuery({ queryKey: ['admin', 'plans'], queryFn: () => api<Row[]>('/super-admin/plans') });
  const [form, setForm] = useState<{ open: boolean; edit?: Row }>({ open: false });
  return (
    <>
      <PageHeader title={tr("Plans")} description={tr("What shops can buy. Leave a limit empty for unlimited.")} actions={manage && <Button onClick={() => setForm({ open: true })}><Plus />{tr("New plan")}</Button>} />
      {isLoading ? <ListSkeleton rows={3} /> : (
        <div className="grid gap-3 md:grid-cols-3">{(data ?? []).map((p) => (
          <Card key={p._id}>
            <CardHeader><CardTitle>{p.name} {!p.isActive && <Badge className="ml-1">{tr("Hidden")}</Badge>}</CardTitle>{manage && <Button size="icon" variant="ghost" aria-label={tr('Edit {name}', { name: p.name })} onClick={() => setForm({ open: true, edit: p })}><Pencil /></Button>}</CardHeader>
            <CardContent className="space-y-2">
              <p className="num text-xl font-semibold">{taka(p.price)}<span className="text-sm font-normal text-muted-foreground"> / {p.durationDays} {tr("days")}</span></p>
              <p className="text-sm text-muted-foreground">{p.limits.employees === null ? tr("Unlimited") : num(p.limits.employees)} {tr("employees ·")} {p.limits.products === null ? tr("Unlimited") : num(p.limits.products)} {tr("products")}</p>
              {(p.features as string[]).map((x) => <p key={x} className="text-sm">• {x}</p>)}
            </CardContent>
          </Card>
        ))}</div>
      )}
      <PlanForm state={form} onClose={() => setForm({ open: false })} />
    </>
  );
}

function PlanForm({ state, onClose }: { state: { open: boolean; edit?: Row }; onClose: () => void }) {
  const { edit } = state;
  const [f, setF] = useState({ name: '', code: '', price: '', days: '30', employees: '', products: '', features: '', active: true, order: '0' });
  useEffect(() => {
    if (!state.open) return;
    setF({ name: edit?.name ?? '', code: edit?.code ?? '', price: fromPaisa(edit?.price), days: String(edit?.durationDays ?? 30), employees: edit?.limits.employees === null || edit === undefined ? '' : String(edit.limits.employees), products: edit?.limits.products === null || edit === undefined ? '' : String(edit.limits.products), features: (edit?.features ?? []).join('\n'), active: edit?.isActive ?? true, order: String(edit?.sortOrder ?? 0) });
  }, [state.open, edit]);
  const save = useAct(
    () => {
      const body = {
        name: f.name.trim(), code: f.code.trim().toLowerCase(), price: toPaisa(f.price) ?? 0, durationDays: parseInt(f.days, 10) || 30,
        limits: { employees: f.employees === '' ? null : parseInt(f.employees, 10), products: f.products === '' ? null : parseInt(f.products, 10) },
        features: f.features.split('\n').map((x) => x.trim()).filter(Boolean), isActive: f.active, sortOrder: parseInt(f.order, 10) || 0,
      };
      return edit ? api(`/super-admin/plans/${edit._id}`, { method: 'PATCH', body }) : api('/super-admin/plans', { method: 'POST', body });
    },
    { ok: tr("Plan saved"), keys: ['admin', 'plans'], onOk: onClose },
  );
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <Modal open={state.open} onOpenChange={(o) => !o && onClose()} title={edit ? tr('Edit {name}', { name: edit.name }) : tr("New plan")} footer={<><Button variant="outline" onClick={onClose}>{tr("Cancel")}</Button><Button loading={save.isPending} disabled={f.name.trim().length < 2 || f.code.trim().length < 2} onClick={() => save.mutate(undefined)}>{tr("Save")}</Button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={tr("Name")}><Input value={f.name} onChange={set('name')} /></Field>
        <Field label={tr("Short code")} hint={tr("Letters only, like basic")}><Input value={f.code} onChange={set('code')} /></Field>
        <Field label={tr("Price (৳)")}><Input value={f.price} onChange={set('price')} inputMode="decimal" /></Field>
        <Field label={tr("Days")}><Input value={f.days} onChange={set('days')} inputMode="numeric" /></Field>
        <Field label={tr("Employee limit")} hint={tr("Empty = unlimited")}><Input value={f.employees} onChange={set('employees')} inputMode="numeric" /></Field>
        <Field label={tr("Product limit")} hint={tr("Empty = unlimited")}><Input value={f.products} onChange={set('products')} inputMode="numeric" /></Field>
        <Field label={tr("Features (one per line)")} className="sm:col-span-2"><Textarea value={f.features} onChange={set('features')} rows={3} /></Field>
        <Field label={tr("Order")}><Input value={f.order} onChange={set('order')} inputMode="numeric" /></Field>
        <div className="flex items-end gap-2 pb-2 text-sm"><Switch checked={f.active} onCheckedChange={(v) => setF({ ...f, active: v })} aria-label={tr("Visible to shops")} />{tr("Visible to shops")}</div>
      </div>
    </Modal>
  );
}
