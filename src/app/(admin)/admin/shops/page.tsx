'use client';
import { tr } from '@/lib/lang';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { EmptyState, ListSkeleton, PageHeader, Pager, SearchBox } from '@/components/common';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Select } from '@/components/ui/input';
import { TBody, TD, TH, THead, TR, Table } from '@/components/ui/table';
import { apiPaged } from '@/lib/api';
import { useDebounced } from '@/lib/hooks';
import type { Row } from '@/lib/types';
import { fmtDate, fmtDateTime } from '@/lib/utils';

const tone = { active: 'success', blocked: 'danger', deleted: 'neutral' } as const;

export default function ShopsPage() {
  const [search, setSearch] = useState('');
  const dq = useDebounced(search);
  const [status, setStatus] = useState('');
  const [deleted, setDeleted] = useState(false);
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({ queryKey: ['admin', 'shops', dq, status, deleted, page], queryFn: () => apiPaged<Row>('/super-admin/shops', { search: dq, status, deleted: deleted || undefined, page, limit: 20 }) });
  return (
    <>
      <PageHeader title={tr("Shops")} description={tr("Open a shop to see its usage meter and control it.")} />
      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b p-3">
          <SearchBox value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder={tr("Shop name or phone")} />
          <Select className="w-40" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label={tr("Status")}><option value="">{tr("All")}</option><option value="active">{tr("Active")}</option><option value="blocked">{tr("Blocked")}</option></Select>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-[rgb(var(--primary))]" checked={deleted} onChange={(e) => { setDeleted(e.target.checked); setPage(1); }} />{tr("Deleted shops")}</label>
        </div>
        {isLoading ? <ListSkeleton /> : !data?.data.length ? <EmptyState title={tr("No shops found")} /> : (
          <Table>
            <THead><TR><TH>#</TH><TH>{tr("Shop")}</TH><TH>{tr("Owner")}</TH><TH>{tr("Plan")}</TH><TH>{tr("Joined")}</TH><TH>{tr("Last login")}</TH><TH>{tr("Status")}</TH></TR></THead>
            <TBody>{data.data.map((s) => {
              const sub = s.subscription;
              const ends = sub.status === 'trial' ? sub.trialEndsAt : sub.paidUntil;
              const expired = !ends || new Date(ends) < new Date();
              return (
                <TR key={s._id}>
                  <TD className="num text-muted-foreground">{s.code}</TD>
                  <TD><Link href={`/admin/shops/${s._id}`} className="font-medium text-primary hover:underline">{s.name}</Link><p className="text-xs text-muted-foreground">{s.phone}</p></TD>
                  <TD>{s.ownerId?.name}<p className="text-xs text-muted-foreground">{s.ownerId?.email}</p></TD>
                  <TD><Badge tone={expired ? 'danger' : sub.status === 'trial' ? 'warning' : 'success'}>{expired ? tr("Ended") : sub.status === 'trial' ? tr("Trial") : tr("Paid")}</Badge><p className="mt-0.5 text-xs text-muted-foreground">{fmtDate(ends)}</p></TD>
                  <TD className="whitespace-nowrap text-muted-foreground">{fmtDate(s.createdAt)}</TD>
                  <TD className="whitespace-nowrap text-muted-foreground">{s.ownerId?.lastLoginAt ? fmtDateTime(s.ownerId.lastLoginAt) : tr("Never")}</TD>
                  <TD><Badge tone={tone[s.status as keyof typeof tone]}>{tr(s.status)}</Badge>{s.restriction?.active && <Badge tone="warning" className="ml-1">{tr("Restricted")}</Badge>}</TD>
                </TR>
              );
            })}</TBody>
          </Table>
        )}
        <Pager meta={data?.meta} onPage={setPage} />
      </Card>
    </>
  );
}
