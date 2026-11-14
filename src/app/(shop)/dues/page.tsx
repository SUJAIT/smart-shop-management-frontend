'use client';
import { tr } from '@/lib/lang';
import { useQuery } from '@tanstack/react-query';
import { HandCoins } from 'lucide-react';
import { useState } from 'react';
import { EmptyState, Field, Kpi, ListSkeleton, PageHeader, Pager, SearchBox } from '@/components/common';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Modal } from '@/components/ui/dialog';
import { Input, Select } from '@/components/ui/input';
import { TBody, TD, TH, THead, TR, Table } from '@/components/ui/table';
import { api, apiPaged } from '@/lib/api';
import { useAct, useDebounced } from '@/lib/hooks';
import type { Row } from '@/lib/types';
import { fmtDate, taka, toInputDate, toPaisa } from '@/lib/utils';

export default function DuesPage() {
  const [search, setSearch] = useState('');
  const dq = useDebounced(search);
  const [filter, setFilter] = useState('open');
  const [page, setPage] = useState(1);
  const [pay, setPay] = useState<Row | null>(null);
  const [amount, setAmount] = useState('');
  const [next, setNext] = useState('');
  const [note, setNote] = useState('');

  const { data: sum } = useQuery({ queryKey: ['dues', 'summary'], queryFn: () => api<Row>('/dues/summary') });
  const { data, isLoading } = useQuery({
    queryKey: ['dues', dq, filter, page],
    queryFn: () => apiPaged<Row>('/dues', { search: dq, page, limit: 20, ...(filter === 'overdue' ? { overdue: true } : { status: filter }) }),
  });
  const collect = useAct(
    () => api(`/dues/${pay!._id}/collect`, { method: 'POST', body: { amount: toPaisa(amount), nextDueDate: next ? new Date(next).toISOString() : undefined, note: note.trim() || undefined } }),
    { ok: tr("Payment recorded"), keys: ['dues', 'sales', 'dashboard'], onOk: () => setPay(null) },
  );
  const openPay = (d: Row) => { setPay(d); setAmount(String(d.dueAmount / 100)); setNext(toInputDate(d.dueDate)); setNote(''); };
  const amt = toPaisa(amount) ?? 0;
  const partial = pay && amt > 0 && amt < pay.dueAmount;

  return (
    <>
      <PageHeader title={tr("Dues")} description={tr("Money your customers still owe you, from credit sales and MFS.")} />
      <Card className="mb-4">
        <div className="grid divide-y sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <CardContent><Kpi label={tr("Total owed to you")} value={taka(sum?.totalDue)} sub={tr('{n} open', { n: sum?.count ?? 0 })} /></CardContent>
          <CardContent><Kpi label={tr("Overdue")} value={taka(sum?.overdueAmount)} tone={sum?.overdueCount ? 'danger' : undefined} sub={tr('{n} customers', { n: sum?.overdueCount ?? 0 })} /></CardContent>
          <CardContent className="flex items-center text-sm text-muted-foreground">{tr("You get a reminder the day before each due date.")}</CardContent>
        </div>
      </Card>
      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b p-3">
          <SearchBox value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder={tr("Customer, phone or invoice")} />
          <Select className="w-40" value={filter} onChange={(e) => { setFilter(e.target.value); setPage(1); }} aria-label={tr("Show")}>
            <option value="open">{tr("Open")}</option><option value="overdue">{tr("Overdue")}</option><option value="paid">{tr("Paid")}</option>
          </Select>
        </div>
        {isLoading ? <ListSkeleton /> : !data?.data.length ? <EmptyState icon={<HandCoins />} title={tr("Nothing owed")} hint={tr("Credit sales appear here with the date the customer promised to pay.")} /> : (
          <Table>
            <THead><TR><TH>{tr("Customer")}</TH><TH>{tr("From")}</TH><TH>{tr("Pay by")}</TH><TH className="text-right">{tr("Total")}</TH><TH className="text-right">{tr("Paid")}</TH><TH className="text-right">{tr("Due")}</TH><TH /></TR></THead>
            <TBody>
              {data.data.map((d) => {
                const late = d.status === 'open' && new Date(d.dueDate) < new Date();
                return (
                  <TR key={d._id}>
                    <TD><p className="font-medium">{d.customerName || d.customerPhone || 'Customer'}</p>{d.customerName && d.customerPhone && <p className="text-xs text-muted-foreground">{d.customerPhone}</p>}</TD>
                    <TD><Badge>{d.source === 'sale' ? d.invoiceNo ?? 'Sale' : tr("MFS")}</Badge></TD>
                    <TD className="whitespace-nowrap">{fmtDate(d.dueDate)} {late && <Badge tone="danger" className="ml-1">{tr("Late")}</Badge>}</TD>
                    <TD className="num text-right">{taka(d.totalAmount)}</TD>
                    <TD className="num text-right text-muted-foreground">{taka(d.paidAmount)}</TD>
                    <TD className="num text-right font-semibold">{taka(d.dueAmount)}</TD>
                    <TD className="text-right">{d.status === 'open' ? <Button size="sm" onClick={() => openPay(d)}>{tr("Collect")}</Button> : <Badge tone="success">{tr("Paid")}</Badge>}</TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        )}
        <Pager meta={data?.meta} onPage={setPage} />
      </Card>

      <Modal open={!!pay} onOpenChange={(o) => !o && setPay(null)} title={tr("Collect payment")} description={pay ? tr('{who} owes {a}', { who: pay.customerName || pay.customerPhone, a: taka(pay.dueAmount) }) : ''} size="sm"
        footer={<><Button variant="outline" onClick={() => setPay(null)}>{tr("Cancel")}</Button><Button loading={collect.isPending} disabled={!amt || (pay ? amt > pay.dueAmount : false)} onClick={() => collect.mutate(undefined)}>{tr("Record")} {taka(amt)}</Button></>}>
        <div className="space-y-3">
          <Field label={tr("Amount received (৳)")}><Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" autoFocus /></Field>
          {partial && <Field label={tr("Will pay the rest by")} hint={tr('{a} stays due.', { a: taka(pay!.dueAmount - amt) })}><Input type="date" value={next} onChange={(e) => setNext(e.target.value)} /></Field>}
          <Field label={tr("Note (optional)")}><Input value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        </div>
      </Modal>
    </>
  );
}
