'use client';
import { tr } from '@/lib/lang';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2 } from 'lucide-react';
import { EmptyState, ListSkeleton, PageHeader } from '@/components/common';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TBody, TD, TH, THead, TR, Table } from '@/components/ui/table';
import { api, apiPaged } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useAct } from '@/lib/hooks';
import type { Row } from '@/lib/types';
import { fmtDate, num, taka } from '@/lib/utils';

const tone: Record<string, 'success' | 'danger' | 'warning' | 'neutral'> = { completed: 'success', failed: 'danger', cancelled: 'neutral', initiated: 'warning', processing: 'warning' };

export default function BillingPage() {
  const { me, isOwner } = useAuth();
  const { data: plans, isLoading } = useQuery({ queryKey: ['plans'], queryFn: () => api<Row[]>('/plans') });
  const { data: pay } = useQuery({ queryKey: ['payments', 'mine'], queryFn: () => apiPaged<Row>('/payments/my', { limit: 10 }), enabled: isOwner });
  const buy = useAct((planId: string) => api<Row>('/payments/bkash/create', { method: 'POST', body: { planId } }), { onOk: (r) => { window.location.href = r.bkashURL; } });
  const sub = me?.subscription;
  if (!isOwner) return <EmptyState title={tr("Only the owner manages the plan")} />;

  return (
    <>
      <PageHeader title={tr("Plan & billing")} description={tr("Pay with bKash. Your plan starts the moment the payment goes through.")} />
      <Card className="mb-4"><CardContent className="flex flex-wrap items-center justify-between gap-3">
        <div><p className="text-[13px] text-muted-foreground">{tr("Your plan now")}</p><p className="text-lg font-semibold capitalize">{sub?.status === 'trial' ? tr("Free trial") : sub?.status === 'expired' ? tr("Ended") : tr("Active")}</p></div>
        <div className="text-right"><p className="text-[13px] text-muted-foreground">{sub?.status === 'expired' ? tr("Ended on") : tr("Runs until")}</p><p className="num text-lg font-semibold">{fmtDate(sub?.endsAt)}{sub?.status !== 'expired' && <span className="ml-2 text-sm font-normal text-muted-foreground">{sub?.daysLeft} {tr("days left")}</span>}</p></div>
      </CardContent></Card>

      {isLoading ? <ListSkeleton rows={2} /> : (
        <div className="grid gap-3 md:grid-cols-3">
          {(plans ?? []).map((p) => {
            const current = String(sub?.planId) === String(p._id) && sub?.status === 'active';
            return (
              <Card key={p._id} className={current ? 'border-primary' : ''}>
                <CardHeader><CardTitle>{p.name}</CardTitle>{current && <Badge tone="primary">{tr("Current")}</Badge>}</CardHeader>
                <CardContent className="space-y-3">
                  <p className="num text-2xl font-semibold">{taka(p.price)}<span className="text-sm font-normal text-muted-foreground"> / {p.durationDays} {tr("days")}</span></p>
                  <ul className="space-y-1.5 text-sm">
                    <li className="flex gap-2"><CheckCircle2 className="mt-0.5 size-4 text-success" />{p.limits.employees === null ? tr("Unlimited employees") : tr('{n} employees', { n: p.limits.employees })}</li>
                    <li className="flex gap-2"><CheckCircle2 className="mt-0.5 size-4 text-success" />{p.limits.products === null ? tr("Unlimited products") : tr('{n} products', { n: num(p.limits.products) })}</li>
                    {(p.features as string[]).map((x) => <li key={x} className="flex gap-2"><CheckCircle2 className="mt-0.5 size-4 text-success" />{x}</li>)}
                  </ul>
                  <Button className="w-full" loading={buy.isPending && buy.variables === p._id} onClick={() => buy.mutate(p._id)}>{current ? tr("Renew with bKash") : tr("Pay with bKash")}</Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Card className="mt-4">
        <CardHeader><CardTitle>{tr("Payments")}</CardTitle></CardHeader>
        <CardContent className="px-0 pb-0 pt-3">
          {!pay?.data.length ? <p className="px-5 pb-5 text-sm text-muted-foreground">{tr("No payments yet.")}</p> : (
            <Table><THead><TR><TH>{tr("Date")}</TH><TH>{tr("Plan")}</TH><TH>{tr("Invoice")}</TH><TH className="text-right">{tr("Amount")}</TH><TH>{tr("Status")}</TH></TR></THead>
              <TBody>{pay.data.map((x) => <TR key={x._id}><TD>{fmtDate(x.createdAt)}</TD><TD>{x.planId?.name}</TD><TD className="text-muted-foreground">{x.merchantInvoiceNumber}</TD><TD className="num text-right">{taka(x.amount)}</TD><TD><Badge tone={tone[x.status]}>{tr(x.status)}</Badge></TD></TR>)}</TBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
