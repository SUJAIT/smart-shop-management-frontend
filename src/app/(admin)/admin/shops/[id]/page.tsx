'use client';
import { tr } from '@/lib/lang';
import { useQuery } from '@tanstack/react-query';
import { Ban, Clock, Megaphone, RotateCcw, ShieldCheck, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Field, Kpi, PageHeader } from '@/components/common';
import { MeterDial, Odometer } from '@/components/meter';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Modal } from '@/components/ui/dialog';
import { Input, Select, Textarea } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { AlertDialog } from '@/components/admin-alert';
import { useAct } from '@/lib/hooks';
import type { Row } from '@/lib/types';
import { fmtDate, fmtDateTime, num, taka } from '@/lib/utils';

const tip = { contentStyle: { background: 'rgb(var(--card))', border: '1px solid rgb(var(--border))', borderRadius: 8, fontSize: 13 }, cursor: { fill: 'rgb(var(--muted))' } };
const axis = { tickLine: false, axisLine: false, fontSize: 12, stroke: 'rgb(var(--muted-foreground))' } as const;

export default function ShopDetail() {
  const { id } = useParams<{ id: string }>();
  const { can } = useAuth();
  const [days, setDays] = useState('30');
  const [gran, setGran] = useState('day');
  const [dlg, setDlg] = useState<'block' | 'restrict' | 'plan' | 'alert' | null>(null);

  const { data: d } = useQuery({ queryKey: ['admin', 'shop', id], queryFn: () => api<Row>(`/super-admin/shops/${id}`) });
  const { data: u } = useQuery({ queryKey: ['admin', 'usage', id, days, gran], queryFn: () => api<Row>(`/super-admin/shops/${id}/usage`, { query: { days, granularity: gran } }) });

  const act = (path: string, ok: string, body?: unknown, method: 'POST' | 'DELETE' = 'POST') =>
    useAct(() => api(`/super-admin/shops/${id}${path}`, { method, body }), { ok, keys: ['admin'], onOk: () => setDlg(null) }); // eslint-disable-line react-hooks/rules-of-hooks
  const unblock = act('/unblock', 'Shop unblocked');
  const unrestrict = act('/unrestrict', 'Restriction removed');
  const restore = act('/restore', 'Shop restored');
  const remove = act('', 'Shop deleted', undefined, 'DELETE');

  if (!d) return <Skeleton className="h-80" />;
  const { shop, subscription: sub, counts } = d;
  const manage = can('shop.manage');
  const series = (u?.series ?? []) as Row[];
  const daily = (u?.series ?? []) as Row[];
  const today = daily[daily.length - 1];
  const peak = Math.max(1, ...daily.map((x) => x.units));
  const modules = Object.entries(
    series.reduce<Record<string, number>>((acc, s) => { Object.entries(s.modules ?? {}).forEach(([k, v]) => { acc[k] = (acc[k] ?? 0) + (v as number); }); return acc; }, {}),
  ).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const maxMod = Math.max(1, ...modules.map((m) => m[1]));
  const fmtX = (v: string) => (gran === 'month' ? v : v.slice(5));

  return (
    <>
      <PageHeader
        title={shop.name}
        description={`Shop #${shop.code} · ${shop.ownerId?.name ?? ''} · ${shop.ownerId?.email ?? ''} · ${shop.phone ?? ''}`}
        actions={<Button asChild variant="outline"><Link href="/admin/shops">{tr("All shops")}</Link></Button>}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge tone={shop.status === 'active' ? 'success' : 'danger'}>{shop.isDeleted ? tr("Deleted") : tr(shop.status)}</Badge>
        <Badge tone={sub.status === 'expired' ? 'danger' : sub.status === 'trial' ? 'warning' : 'success'}>{sub.status === 'trial' ? tr("Trial") : sub.status === 'expired' ? tr("Plan ended") : tr("Paid")} · {fmtDate(sub.endsAt)}</Badge>
        {shop.restriction?.active && <Badge tone="warning">{tr("Restricted until")} {fmtDateTime(shop.restriction.until)}</Badge>}
        {d.lastSeen && <span className="text-sm text-muted-foreground">{tr("Last seen")} {fmtDateTime(d.lastSeen.lastSeenAt)}</span>}
      </div>

      {manage && (
        <Card className="mb-4"><CardContent className="flex flex-wrap gap-2">
          {shop.isDeleted ? <Button variant="outline" loading={restore.isPending} onClick={() => restore.mutate(undefined)}><RotateCcw />{tr("Restore shop")}</Button> : (<>
            {shop.status === 'blocked' ? <Button variant="success" loading={unblock.isPending} onClick={() => unblock.mutate(undefined)}><ShieldCheck />{tr("Unblock")}</Button> : <Button variant="outline" onClick={() => setDlg('block')}><Ban />{tr("Block")}</Button>}
            {shop.restriction?.active ? <Button variant="outline" loading={unrestrict.isPending} onClick={() => unrestrict.mutate(undefined)}>{tr("Remove restriction")}</Button> : <Button variant="outline" onClick={() => setDlg('restrict')}><Clock />{tr("Restrict for a time")}</Button>}
            <Button variant="outline" onClick={() => setDlg('plan')}>{tr("Give plan")}</Button>
            {can('alert.send') && <Button variant="outline" onClick={() => setDlg('alert')}><Megaphone />{tr("Send alert")}</Button>}
            <Button variant="outline" className="ml-auto text-danger" onClick={() => confirm(tr('Delete {name}? It can be restored later.', { name: shop.name })) && remove.mutate(undefined)}><Trash2 />{tr("Delete")}</Button>
          </>)}
        </CardContent></Card>
      )}

      {d.activeAlerts.length > 0 && (
        <div className="mb-4 space-y-2">{(d.activeAlerts as Row[]).map((a) => (
          <div key={a._id} className="flex items-start justify-between gap-3 rounded-lg border bg-card p-3 text-sm"><div><p className="font-medium">{a.title} <Badge tone={a.level === 'hard' ? 'danger' : 'primary'}>{a.level}</Badge></p><p className="text-muted-foreground">{a.message}</p></div>{can('alert.send') && <ResolveButton id={a._id} />}</div>
        ))}</div>
      )}

      <Card className="mb-4"><div className="grid grid-cols-2 divide-x divide-y sm:grid-cols-5 sm:divide-y-0">
        <CardContent><Kpi label={tr("Employees")} value={num(counts.employees)} /></CardContent>
        <CardContent><Kpi label={tr("Products")} value={num(counts.products)} /></CardContent>
        <CardContent><Kpi label={tr("Sales")} value={num(counts.sales)} /></CardContent>
        <CardContent><Kpi label={tr("MFS entries")} value={num(counts.mfsTransactions)} /></CardContent>
        <CardContent><Kpi label={tr("Open dues")} value={num(counts.openDues)} /></CardContent>
      </div></Card>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">{tr("Usage meter")}</h2>
        <div className="flex gap-2">
          <Select className="w-36" value={days} onChange={(e) => setDays(e.target.value)} aria-label={tr("Range")}><option value="7">{tr("Last 7 days")}</option><option value="30">{tr("Last 30 days")}</option><option value="90">{tr("Last 90 days")}</option><option value="365">{tr("Last year")}</option></Select>
          <Select className="w-32" value={gran} onChange={(e) => setGran(e.target.value)} aria-label={tr("Group by")}><option value="day">{tr("By day")}</option><option value="month">{tr("By month")}</option></Select>
        </div>
      </div>

      {!u ? <Skeleton className="h-64" /> : (
        <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
          <div className="space-y-3">
            <MeterDial value={today?.units ?? 0} max={peak} label={tr("Units today")} />
            <Odometer value={u.totals.units} label={tr('Units in {n} days', { n: days })} />
            <Card><CardContent className="grid grid-cols-2 gap-3">
              <Kpi label={tr("Requests")} value={num(u.totals.requests)} />
              <Kpi label={tr("Active minutes")} value={num(u.totals.activeMinutes)} />
              <Kpi label={tr("Sales made")} value={num(u.totals.sales)} />
              <Kpi label={tr("Products added")} value={num(u.totals.products)} />
            </CardContent></Card>
          </div>
          <div className="space-y-4">
            <Card><CardHeader><CardTitle>{tr("Units saved")}</CardTitle></CardHeader><CardContent><div className="h-52"><ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ left: -15, right: 4 }}><CartesianGrid vertical={false} stroke="rgb(var(--border))" /><XAxis dataKey="date" tickFormatter={fmtX} {...axis} /><YAxis {...axis} /><Tooltip {...tip} />
                <Area dataKey="units" name="Units" stroke="rgb(var(--chart-1))" fill="rgb(var(--chart-1))" fillOpacity={0.15} strokeWidth={2} /></AreaChart>
            </ResponsiveContainer></div></CardContent></Card>
            <div className="grid gap-4 md:grid-cols-2">
              <Card><CardHeader><CardTitle>{tr("Work created")}</CardTitle></CardHeader><CardContent><div className="h-48"><ResponsiveContainer width="100%" height="100%">
                <BarChart data={series} margin={{ left: -15, right: 4 }}><CartesianGrid vertical={false} stroke="rgb(var(--border))" /><XAxis dataKey="date" tickFormatter={fmtX} {...axis} /><YAxis {...axis} /><Tooltip {...tip} /><Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="sales" name="Sales" stackId="a" fill="rgb(var(--chart-1))" /><Bar dataKey="mfsTransactions" name="MFS" stackId="a" fill="rgb(var(--chart-2))" /><Bar dataKey="products" name="Products" stackId="a" fill="rgb(var(--chart-3))" /></BarChart>
              </ResponsiveContainer></div></CardContent></Card>
              <Card><CardHeader><CardTitle>{tr("Time in the app (minutes)")}</CardTitle></CardHeader><CardContent><div className="h-48"><ResponsiveContainer width="100%" height="100%">
                <LineChart data={series} margin={{ left: -15, right: 4 }}><CartesianGrid vertical={false} stroke="rgb(var(--border))" /><XAxis dataKey="date" tickFormatter={fmtX} {...axis} /><YAxis {...axis} /><Tooltip {...tip} />
                  <Line dataKey="activeMinutes" name="Minutes" stroke="rgb(var(--chart-5))" strokeWidth={2} dot={false} /></LineChart>
              </ResponsiveContainer></div></CardContent></Card>
            </div>
            {modules.length > 0 && (
              <Card><CardHeader><CardTitle>{tr("Where the requests go")}</CardTitle></CardHeader><CardContent><ul className="space-y-2">{modules.map(([k, v]) => (
                <li key={k} className="grid grid-cols-[100px_1fr_60px] items-center gap-3 text-sm"><span className="capitalize">{k}</span><span className="h-2 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-primary" style={{ width: `${(v / maxMod) * 100}%` }} /></span><span className="num text-right text-muted-foreground">{num(v)}</span></li>
              ))}</ul></CardContent></Card>
            )}
          </div>
        </div>
      )}

      {d.recentPayments.length > 0 && (
        <Card className="mt-4"><CardHeader><CardTitle>{tr("Recent payments")}</CardTitle></CardHeader><CardContent><ul className="divide-y text-sm">{(d.recentPayments as Row[]).map((p) => (
          <li key={p._id} className="flex justify-between py-2"><span>{fmtDate(p.createdAt)} · {p.merchantInvoiceNumber}</span><span className="num">{taka(p.amount)} <Badge tone={p.status === 'completed' ? 'success' : 'neutral'}>{p.status}</Badge></span></li>
        ))}</ul></CardContent></Card>
      )}

      <BlockDialog open={dlg === 'block'} id={id} onClose={() => setDlg(null)} />
      <RestrictDialog open={dlg === 'restrict'} id={id} onClose={() => setDlg(null)} />
      <PlanDialog open={dlg === 'plan'} id={id} onClose={() => setDlg(null)} />
      <AlertDialog open={dlg === 'alert'} shopId={id} onClose={() => setDlg(null)} />
    </>
  );
}

function ResolveButton({ id }: { id: string }) {
  const r = useAct(() => api(`/super-admin/alerts/${id}/resolve`, { method: 'POST' }), { ok: tr("Alert resolved"), keys: ['admin'] });
  return <Button size="sm" variant="outline" loading={r.isPending} onClick={() => r.mutate(undefined)}>{tr("Resolve")}</Button>;
}

function BlockDialog({ open, id, onClose }: { open: boolean; id: string; onClose: () => void }) {
  const [reason, setReason] = useState('');
  const s = useAct(() => api(`/super-admin/shops/${id}/block`, { method: 'POST', body: { reason: reason.trim() || undefined } }), { ok: tr("Shop blocked"), keys: ['admin'], onOk: onClose });
  return (
    <Modal open={open} onOpenChange={(o) => !o && onClose()} size="sm" title={tr("Block this shop?")} description={tr("Everyone in the shop is logged out and cannot log in until you unblock.")} footer={<><Button variant="outline" onClick={onClose}>{tr("Cancel")}</Button><Button variant="danger" loading={s.isPending} onClick={() => s.mutate(undefined)}>{tr("Block shop")}</Button></>}>
      <Field label={tr("Message shown to them (optional)")}><Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder={tr("Please contact support about your unpaid bill.")} /></Field>
    </Modal>
  );
}

function RestrictDialog({ open, id, onClose }: { open: boolean; id: string; onClose: () => void }) {
  const [hours, setHours] = useState('24');
  const [message, setMessage] = useState('');
  const s = useAct(() => api(`/super-admin/shops/${id}/restrict`, { method: 'POST', body: { hours: Number(hours), message: message.trim() } }), { ok: tr("Shop restricted"), keys: ['admin'], onOk: onClose });
  return (
    <Modal open={open} onOpenChange={(o) => !o && onClose()} size="sm" title={tr("Restrict for a time")} description={tr("They can log in, but every click shows your message. Chat and billing stay open.")} footer={<><Button variant="outline" onClick={onClose}>{tr("Cancel")}</Button><Button loading={s.isPending} disabled={!Number(hours) || message.trim().length < 3} onClick={() => s.mutate(undefined)}>{tr("Restrict")}</Button></>}>
      <div className="space-y-3">
        <Field label={tr("For how many hours?")}><Input value={hours} onChange={(e) => setHours(e.target.value)} inputMode="numeric" className="max-w-32" /></Field>
        <Field label={tr("Message")}><Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} /></Field>
      </div>
    </Modal>
  );
}

function PlanDialog({ open, id, onClose }: { open: boolean; id: string; onClose: () => void }) {
  const { data: plans = [] } = useQuery({ queryKey: ['admin', 'plans'], queryFn: () => api<Row[]>('/super-admin/plans'), enabled: open });
  const [planId, setPlanId] = useState('');
  const [days, setDays] = useState('');
  const s = useAct(() => api(`/super-admin/shops/${id}/subscription`, { method: 'POST', body: { planId: planId || plans[0]?._id, days: days ? parseInt(days, 10) : undefined } }), { ok: tr("Plan given"), keys: ['admin'], onOk: onClose });
  return (
    <Modal open={open} onOpenChange={(o) => !o && onClose()} size="sm" title={tr("Give a plan")} description={tr("Use this when the shop paid in cash. It works like a bKash payment.")} footer={<><Button variant="outline" onClick={onClose}>{tr("Cancel")}</Button><Button loading={s.isPending} disabled={!plans.length} onClick={() => s.mutate(undefined)}>{tr("Give plan")}</Button></>}>
      <div className="space-y-3">
        <Field label={tr("Plan")}><Select value={planId || plans[0]?._id || ''} onChange={(e) => setPlanId(e.target.value)}>{plans.map((p) => <option key={p._id} value={p._id}>{p.name} · {taka(p.price)} / {p.durationDays} {tr("days")}</option>)}</Select></Field>
        <Field label={tr("Days (optional)")} hint={tr("Empty uses the plan’s own length.")}><Input value={days} onChange={(e) => setDays(e.target.value)} inputMode="numeric" className="max-w-32" /></Field>
      </div>
    </Modal>
  );
}
