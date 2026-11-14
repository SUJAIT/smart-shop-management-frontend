'use client';
import { tr } from '@/lib/lang';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { EmptyState, ListSkeleton, PageHeader, Pager, SearchBox } from '@/components/common';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Select } from '@/components/ui/input';
import { TBody, TD, TH, THead, TR, Table } from '@/components/ui/table';
import { apiPaged } from '@/lib/api';
import { useDebounced } from '@/lib/hooks';
import type { Row } from '@/lib/types';
import { fmtDateTime, taka } from '@/lib/utils';

const tone: Record<string, 'success' | 'danger' | 'warning' | 'neutral'> = { completed: 'success', failed: 'danger', cancelled: 'neutral', initiated: 'warning', processing: 'warning' };

export default function PaymentsPage() {
  const [search, setSearch] = useState('');
  const dq = useDebounced(search);
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({ queryKey: ['admin', 'payments', dq, status, page], queryFn: () => apiPaged<Row>('/super-admin/payments', { search: dq, status, page, limit: 20 }) });
  return (
    <>
      <PageHeader title={tr("Payments")} description={tr("bKash subscription payments from every shop.")} />
      <Card>
        <div className="flex flex-wrap gap-2 border-b p-3">
          <SearchBox value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder={tr("Invoice or bKash trxID")} />
          <Select className="w-40" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label={tr("Status")}><option value="">{tr("All")}</option>{Object.keys(tone).map((s) => <option key={s} value={s}>{s}</option>)}</Select>
        </div>
        {isLoading ? <ListSkeleton /> : !data?.data.length ? <EmptyState title={tr("No payments")} /> : (
          <Table>
            <THead><TR><TH>{tr("Date")}</TH><TH>{tr("Shop")}</TH><TH>{tr("Plan")}</TH><TH>{tr("Invoice")}</TH><TH>{tr("trxID")}</TH><TH className="text-right">{tr("Amount")}</TH><TH>{tr("Status")}</TH></TR></THead>
            <TBody>{data.data.map((p) => (
              <TR key={p._id}><TD className="whitespace-nowrap text-muted-foreground">{fmtDateTime(p.createdAt)}</TD><TD>{p.shopId?.name}</TD><TD>{p.planId?.name}</TD><TD className="text-muted-foreground">{p.merchantInvoiceNumber}</TD><TD>{p.trxID ?? '-'}</TD><TD className="num text-right font-medium">{taka(p.amount)}</TD><TD><Badge tone={tone[p.status]}>{tr(p.status)}</Badge>{p.statusCode === 'MISMATCH' && <p className="mt-0.5 text-xs text-danger">{tr("Needs review")}</p>}</TD></TR>
            ))}</TBody>
          </Table>
        )}
        <Pager meta={data?.meta} onPage={setPage} />
      </Card>
    </>
  );
}
