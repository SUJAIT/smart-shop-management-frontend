'use client';
import { tr } from '@/lib/lang';
import { useQuery } from '@tanstack/react-query';
import { Megaphone, Plus } from 'lucide-react';
import { useState } from 'react';
import { AlertDialog } from '@/components/admin-alert';
import { EmptyState, Field, ListSkeleton, PageHeader, Pager } from '@/components/common';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Modal } from '@/components/ui/dialog';
import { Select } from '@/components/ui/input';
import { api, apiPaged } from '@/lib/api';
import { useAct } from '@/lib/hooks';
import type { Row } from '@/lib/types';
import { fmtDateTime } from '@/lib/utils';

export default function AlertsPage() {
  const [page, setPage] = useState(1);
  const [pick, setPick] = useState(false);
  const [shopId, setShopId] = useState('');
  const [send, setSend] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ['admin', 'alerts', page], queryFn: () => apiPaged<Row>('/super-admin/alerts', { page, limit: 20 }) });
  const { data: shops } = useQuery({ queryKey: ['admin', 'shops', 'pick'], queryFn: () => apiPaged<Row>('/super-admin/shops', { limit: 100, sort: 'name' }), enabled: pick });
  const resolve = useAct((id: string) => api(`/super-admin/alerts/${id}/resolve`, { method: 'POST' }), { ok: tr("Alert resolved"), keys: ['admin'] });

  return (
    <>
      <PageHeader title={tr("Alerts")} description={tr("Messages and bill reminders sent to shops.")} actions={<Button onClick={() => setPick(true)}><Plus />{tr("New alert")}</Button>} />
      <Card>
        {isLoading ? <ListSkeleton /> : !data?.data.length ? <EmptyState icon={<Megaphone />} title={tr("No alerts sent yet")} /> : (
          <ul className="divide-y">{data.data.map((a) => (
            <li key={a._id} className="flex items-start gap-3 p-4">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium">{a.title}<Badge tone={a.level === 'hard' ? 'danger' : 'primary'}>{a.level === 'hard' ? tr("Hard") : tr("Simple")}</Badge>{a.tag === 'billing' && <Badge tone="warning">{tr("Bill")}</Badge>}{a.resolvedAt && <Badge tone="success">{tr("Resolved")}</Badge>}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">{a.message}</p>
                <p className="mt-1 text-xs text-muted-foreground">{a.shopId?.name} · {fmtDateTime(a.createdAt)}</p>
              </div>
              {!a.resolvedAt && <Button size="sm" variant="outline" onClick={() => resolve.mutate(a._id)}>{tr("Resolve")}</Button>}
            </li>
          ))}</ul>
        )}
        <Pager meta={data?.meta} onPage={setPage} />
      </Card>

      <Modal open={pick} onOpenChange={setPick} size="sm" title={tr("Which shop?")} footer={<><Button variant="outline" onClick={() => setPick(false)}>{tr("Cancel")}</Button><Button disabled={!(shopId || shops?.data[0])} onClick={() => { setPick(false); setSend(true); }}>{tr("Continue")}</Button></>}>
        <Field label={tr("Shop")}><Select value={shopId || shops?.data[0]?._id || ''} onChange={(e) => setShopId(e.target.value)}>{(shops?.data ?? []).map((s) => <option key={s._id} value={s._id}>#{s.code} {s.name}</option>)}</Select></Field>
      </Modal>
      <AlertDialog open={send} shopId={shopId || shops?.data[0]?._id || ''} onClose={() => setSend(false)} />
    </>
  );
}
