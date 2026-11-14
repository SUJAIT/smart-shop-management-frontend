'use client';
import { tr } from '@/lib/lang';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { EmptyState, Field, Kpi, ListSkeleton, PageHeader, chartColor } from '@/components/common';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Modal } from '@/components/ui/dialog';
import { Input, Select } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { TBody, TD, TH, THead, TR, Table } from '@/components/ui/table';
import { api, apiPaged } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useAct } from '@/lib/hooks';
import { CAPITAL_SOURCE_LABEL, SECTORS, SECTOR_LABEL } from '@/lib/labels';
import type { Row } from '@/lib/types';
import { addDaysInput, fmtDate, taka, toPaisa } from '@/lib/utils';

export default function CapitalPage() {
  const { isOwner } = useAuth();
  const [add, setAdd] = useState(false);
  const [repay, setRepay] = useState<Row | null>(null);
  const { data: s, isLoading } = useQuery({ queryKey: ['capital', 'summary'], queryFn: () => api<Row>('/capital/summary'), enabled: isOwner });
  const { data: list } = useQuery({ queryKey: ['capital', 'list'], queryFn: () => apiPaged<Row>('/capital', { limit: 100 }), enabled: isOwner });
  const { data: rep } = useQuery({ queryKey: ['capital', 'report'], queryFn: () => api<Row>('/capital/sector-report', { query: { months: 6 } }), enabled: isOwner });
  const track = useAct((enabled: boolean) => api('/shop/capital-tracking', { method: 'PATCH', body: { enabled } }), { ok: tr("Saved"), keys: ['capital', 'shop', 'dashboard'] });
  const del = useAct((id: string) => api(`/capital/${id}`, { method: 'DELETE' }), { ok: tr("Entry removed"), keys: ['capital', 'dashboard'] });

  if (!isOwner) return <EmptyState title={tr("Capital is for the shop owner")} />;
  if (isLoading || !s) return <ListSkeleton rows={4} />;

  const chart = ((rep?.series ?? []) as Row[]).map((m) => ({ month: m.month.slice(5) + '/' + m.month.slice(2, 4), ...Object.fromEntries(SECTORS.map((k) => [k, Math.round((m.sectors[k] ?? 0) / 100)])) }));

  return (
    <>
      <PageHeader title={tr("Capital")} description={tr("Where your money came from, what you owe, and what each part of the shop earns.")} actions={<Button onClick={() => setAdd(true)}><Plus />{tr("Add capital")}</Button>} />

      <Card className="mb-4">
        <div className="grid grid-cols-2 divide-x divide-y lg:grid-cols-4 lg:divide-y-0">
          <CardContent><Kpi label={tr("Capital in the shop")} value={taka(s.netCapital)} sub={tr('Put in {a} · paid back {b}', { a: taka(s.totalCapital), b: taka(s.totalRepaid) })} /></CardContent>
          <CardContent><Kpi label={tr("Left after buying stock")} value={taka(s.capitalBalance)} tone={s.capitalBalance < 0 ? 'danger' : undefined} sub={tr('Spent on stock {a}', { a: taka(s.totalPurchased) })} /></CardContent>
          <CardContent><Kpi label={tr("Stock on shelves (cost)")} value={taka(s.remainingStockValue)} sub={tr('{n} units', { n: s.remainingStockUnits })} /></CardContent>
          <CardContent><Kpi label={tr("You owe")} value={taka(s.liabilities.friendFamilyOwed + s.liabilities.loanOutstanding)} tone={s.liabilities.loanOutstanding ? 'warning' : undefined} sub={tr('Loan interest {a} / month', { a: taka(s.liabilities.monthlyLoanInterest) })} /></CardContent>
        </div>
        <div className="flex items-center justify-between gap-3 border-t px-5 py-3 text-sm">
          <span>{tr("Take the cost of bought stock out of capital")}</span>
          <Switch checked={s.capitalTracking === true} onCheckedChange={(v) => track.mutate(v)} aria-label={tr("Track capital against purchases")} />
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>{tr("Capital entries")}</CardTitle></CardHeader>
          <CardContent className="pt-3">
            {!list?.data.length ? <p className="text-sm text-muted-foreground">{tr("No capital added yet. Add your own money, money from friends or family, or a loan.")}</p> : (
              <ul className="divide-y">{list.data.map((e) => {
                const out = e.amount - e.repaidAmount;
                const date = e.source === 'friend_family' ? e.dueDate : e.loan?.endDate;
                return (
                  <li key={e._id} className="flex items-start gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 text-sm font-medium">{CAPITAL_SOURCE_LABEL[e.source]}{e.personName && <span className="font-normal text-muted-foreground">· {e.personName}</span>}{e.status === 'closed' && <Badge tone="success">{tr("Paid back")}</Badge>}</p>
                      <p className="num mt-0.5 text-[13px] text-muted-foreground">
                        {taka(e.amount)} {tr("on")} {fmtDate(e.date)}
                        {e.source !== 'personal' && e.status === 'active' && ` · ${tr('owe')} ${taka(out)}`}
                        {date && ` · ${tr('return by')} ${fmtDate(date)}`}
                        {e.source === 'loan' && e.loan?.monthlyInterest ? ` · ${tr('interest {a} per month, paid on day {d}', { a: taka(e.loan.monthlyInterest), d: e.loan.interestDueDay ?? '-' })}` : ''}
                      </p>
                    </div>
                    {e.source !== 'personal' && e.status === 'active' && <Button size="sm" variant="outline" onClick={() => setRepay(e)}>{tr("Pay back")}</Button>}
                    <Button size="icon" variant="ghost" aria-label={tr("Remove entry")} onClick={() => confirm(tr("Remove this capital entry?")) && del.mutate(e._id)}><Trash2 className="text-danger" /></Button>
                  </li>
                );
              })}</ul>
            )}
          </CardContent>
        </Card>

        <AllocationCard s={s} />
      </div>

      <Card className="mt-4">
        <CardHeader><CardTitle>{tr("Monthly profit by sector")}</CardTitle></CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart} margin={{ left: -10, right: 4, top: 8 }}>
                <CartesianGrid vertical={false} stroke="rgb(var(--border))" />
                <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} stroke="rgb(var(--muted-foreground))" />
                <YAxis tickLine={false} axisLine={false} fontSize={12} stroke="rgb(var(--muted-foreground))" />
                <Tooltip formatter={(v: number, n: string) => [taka(v * 100), SECTOR_LABEL[n] ?? n]} contentStyle={{ background: 'rgb(var(--card))', border: '1px solid rgb(var(--border))', borderRadius: 8, fontSize: 13 }} cursor={{ fill: 'rgb(var(--muted))' }} />
                <Legend formatter={(n) => SECTOR_LABEL[n] ?? n} iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                {SECTORS.map((k, i) => <Bar key={k} dataKey={k} stackId="p" fill={chartColor(i + 1)} />)}
              </BarChart>
            </ResponsiveContainer>
          </div>
          {(rep?.currentMonthRoi ?? []).length > 0 && (
            <Table className="mt-4">
              <THead><TR><TH>{tr("Sector")}</TH><TH className="text-right">{tr("Money given")}</TH><TH className="text-right">{tr("Profit this month")}</TH><TH className="text-right">{tr("Return")}</TH></TR></THead>
              <TBody>{(rep!.currentMonthRoi as Row[]).map((r) => (
                <TR key={r.sector}><TD>{SECTOR_LABEL[r.sector]}</TD><TD className="num text-right">{taka(r.allocated)}</TD><TD className="num text-right">{taka(r.profit)}</TD><TD className="num text-right">{r.roiPct === null ? '-' : `${r.roiPct}%`}</TD></TR>
              ))}</TBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AddDialog open={add} onClose={() => setAdd(false)} />
      <RepayDialog entry={repay} onClose={() => setRepay(null)} />
    </>
  );
}

function AllocationCard({ s }: { s: Row }) {
  const auto: boolean = s.autoSplit === true;
  const [vals, setVals] = useState<Record<string, string>>({});
  useEffect(() => {
    setVals(Object.fromEntries((s.manualAllocations as Row[]).map((a) => [a.sector, String(a.amount / 100)])));
  }, [s]);
  const total = SECTORS.reduce((sum, k) => sum + (toPaisa(vals[k]) ?? 0), 0);
  const left = s.netCapital - total;
  const autoOf = (k: string) => (s.autoSectors as Row[]).find((x) => x.sector === k);
  const toggle = useAct((enabled: boolean) => api('/capital/auto-split', { method: 'PUT', body: { enabled } }), { ok: tr("Saved"), keys: ['capital', 'dashboard'] });
  const save = useAct(() => api('/capital/allocations', { method: 'PUT', body: { allocations: SECTORS.filter((k) => (toPaisa(vals[k]) ?? 0) > 0).map((k) => ({ sector: k, amount: toPaisa(vals[k]) })) } }), { ok: tr("Split saved"), keys: ['capital', 'dashboard'] });
  const fromStock = () => setVals(Object.fromEntries((s.autoSectors as Row[]).filter((x) => x.amount > 0).map((x) => [x.sector, String(x.amount / 100)])));
  return (
    <Card>
      <CardHeader><div><CardTitle>{tr("Split your capital by sector")}</CardTitle><p className="mt-1 text-[13px] text-muted-foreground">{tr("Example: MFS ৳2,00,000, Mobile ৳1,00,000, Others ৳2,00,000. Then see the return on each.")}</p></div></CardHeader>
      <div className="flex items-center justify-between gap-3 border-y px-5 py-3 text-sm">
        <div className="min-w-0">
          <p className="font-medium">{tr("Auto split your capital by sector")}</p>
          <p className="text-[13px] text-muted-foreground">{auto ? tr("ON: the app counts how much money worth of products is in each sector.") : tr("OFF: you decide how much money goes to each sector.")}</p>
        </div>
        <Switch checked={auto} disabled={toggle.isPending} onCheckedChange={(v) => toggle.mutate(v)} aria-label={tr("Auto split your capital by sector")} />
      </div>
      <CardContent className="space-y-2 pt-4">
        {auto ? (
          <>
            {SECTORS.map((k) => {
              const v = autoOf(k);
              return (
                <div key={k} className="flex items-center gap-3 text-sm">
                  <span className="w-36 shrink-0">{SECTOR_LABEL[k]}</span>
                  <span className="num w-28 shrink-0 text-right font-medium">{taka(v?.amount ?? 0)}</span>
                  <span className="min-w-0 truncate text-xs text-muted-foreground">
                    {tr('{n} units', { n: v?.units ?? 0 })}{k === 'mfs' && s.mfsEBalance > 0 ? ` · ${tr('e-balance {a}', { a: taka(s.mfsEBalance) })}` : ''}
                  </span>
                </div>
              );
            })}
            <div className="space-y-1 border-t pt-3 text-sm">
              <p className={s.unallocated < 0 ? 'text-warning' : 'text-muted-foreground'}>
                {s.unallocated < 0 ? tr('Stock is worth {a} more than the capital you added (profit went back into stock).', { a: taka(-s.unallocated) }) : tr('Not in any sector (cash and other): {a}', { a: taka(s.unallocated) })}
              </p>
              <p className="text-[13px] text-muted-foreground">{tr("Each sector counts the products of the categories you put in it.")} <Link href="/categories" className="font-medium text-primary underline-offset-2 hover:underline">{tr("Change a category’s sector")}</Link></p>
            </div>
          </>
        ) : (
          <>
            {SECTORS.map((k) => (
              <div key={k} className="flex items-center gap-3"><label htmlFor={`al-${k}`} className="w-36 text-sm">{SECTOR_LABEL[k]}</label><Input id={`al-${k}`} inputMode="decimal" value={vals[k] ?? ''} onChange={(e) => setVals({ ...vals, [k]: e.target.value })} placeholder="0" className="num" /></div>
            ))}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 text-sm">
              <span className={left < 0 ? 'text-danger' : 'text-muted-foreground'}>{left < 0 ? tr('Over by {a}', { a: taka(-left) }) : tr('Not given to a sector: {a}', { a: taka(left) })}</span>
              <span className="flex gap-2">
                <Button variant="outline" onClick={fromStock}>{tr("Fill from my stock")}</Button>
                <Button loading={save.isPending} disabled={left < 0} onClick={() => save.mutate(undefined)}>{tr("Save split")}</Button>
              </span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function AddDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [src, setSrc] = useState('personal');
  const [f, setF] = useState({ amount: '', person: '', note: '', date: addDaysInput(0), due: '', notify: '1', rate: '', interest: '', day: '', end: '' });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const save = useAct(
    () => api('/capital', { method: 'POST', body: {
      source: src, amount: toPaisa(f.amount), personName: f.person.trim() || undefined, note: f.note.trim() || undefined, date: f.date ? new Date(f.date).toISOString() : undefined,
      dueDate: src === 'friend_family' && f.due ? new Date(f.due).toISOString() : undefined, notifyBeforeDays: parseInt(f.notify, 10) || 1,
      loan: src === 'loan' ? { interestRatePct: f.rate ? Number(f.rate) : undefined, monthlyInterest: toPaisa(f.interest), interestDueDay: f.day ? parseInt(f.day, 10) : undefined, endDate: f.end ? new Date(f.end).toISOString() : undefined } : undefined,
    } }),
    { ok: tr("Capital added"), keys: ['capital', 'dashboard'], onOk: () => { onClose(); setF({ ...f, amount: '', person: '', note: '' }); } },
  );
  return (
    <Modal open={open} onOpenChange={(o) => !o && onClose()} title={tr("Add capital")} footer={<><Button variant="outline" onClick={onClose}>{tr("Cancel")}</Button><Button loading={save.isPending} disabled={!toPaisa(f.amount)} onClick={() => save.mutate(undefined)}>{tr("Add")}</Button></>}>
      <div className="space-y-3">
        <Field label={tr("Where is the money from?")}><Select value={src} onChange={(e) => setSrc(e.target.value)}>{Object.entries(CAPITAL_SOURCE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={tr("Amount (৳)")}><Input value={f.amount} onChange={set('amount')} inputMode="decimal" autoFocus /></Field>
          <Field label={tr("Date")}><Input type="date" value={f.date} onChange={set('date')} /></Field>
        </div>
        {src !== 'personal' && <Field label={src === 'loan' ? tr("Lender (bank or person)") : tr("Who gave it?")}><Input value={f.person} onChange={set('person')} /></Field>}
        {src === 'friend_family' && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={tr("Return by")}><Input type="date" value={f.due} onChange={set('due')} /></Field>
            <Field label={tr("Remind me (days before)")}><Input value={f.notify} onChange={set('notify')} inputMode="numeric" /></Field>
          </div>
        )}
        {src === 'loan' && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={tr("Interest rate (%)")}><Input value={f.rate} onChange={set('rate')} inputMode="decimal" /></Field>
            <Field label={tr("Interest per month (৳)")}><Input value={f.interest} onChange={set('interest')} inputMode="decimal" /></Field>
            <Field label={tr("Interest is paid on day of month")} hint={tr("1 to 28")}><Input value={f.day} onChange={set('day')} inputMode="numeric" /></Field>
            <Field label={tr("Loan ends on")}><Input type="date" value={f.end} onChange={set('end')} /></Field>
          </div>
        )}
        <Field label={tr("Note (optional)")}><Input value={f.note} onChange={set('note')} /></Field>
      </div>
    </Modal>
  );
}

function RepayDialog({ entry, onClose }: { entry: Row | null; onClose: () => void }) {
  const [amt, setAmt] = useState('');
  useEffect(() => { setAmt(entry ? String((entry.amount - entry.repaidAmount) / 100) : ''); }, [entry]);
  const save = useAct(() => api(`/capital/${entry!._id}/repay`, { method: 'POST', body: { amount: toPaisa(amt) } }), { ok: tr("Payment recorded"), keys: ['capital', 'dashboard'], onOk: onClose });
  return (
    <Modal open={!!entry} onOpenChange={(o) => !o && onClose()} size="sm" title={tr("Pay back")} description={entry ? tr('You still owe {a} to {who}', { a: taka(entry.amount - entry.repaidAmount), who: entry.personName ?? tr('the lender') }) : ''} footer={<><Button variant="outline" onClick={onClose}>{tr("Cancel")}</Button><Button loading={save.isPending} disabled={!toPaisa(amt)} onClick={() => save.mutate(undefined)}>{tr("Record")}</Button></>}>
      <Field label={tr("Amount paid (৳)")}><Input value={amt} onChange={(e) => setAmt(e.target.value)} inputMode="decimal" autoFocus /></Field>
    </Modal>
  );
}
