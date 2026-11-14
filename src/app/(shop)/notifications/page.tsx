'use client';
import { tr } from '@/lib/lang';
import { useQuery } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import { useState } from 'react';
import { EmptyState, ListSkeleton, PageHeader, Pager } from '@/components/common';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { api, apiPaged } from '@/lib/api';
import { useAct } from '@/lib/hooks';
import { fmtDateTime } from '@/lib/utils';

export default function NotificationsPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({ queryKey: ['notifications', 'list', page], queryFn: () => apiPaged('/notifications', { page, limit: 20 }) });
  const read = useAct((id: string) => api(`/notifications/${id}/read`, { method: 'PATCH' }), { keys: ['notifications'] });
  const readAll = useAct(() => api('/notifications/read-all', { method: 'PATCH' }), { ok: tr("All marked as read"), keys: ['notifications'] });
  return (
    <>
      <PageHeader title={tr("Notifications")} description={tr("Due dates, loan reminders and messages from support.")} actions={<Button variant="outline" onClick={() => readAll.mutate(undefined)}>{tr("Mark all as read")}</Button>} />
      <Card>
        {isLoading ? <ListSkeleton /> : !data?.data.length ? <EmptyState icon={<Bell />} title={tr("Nothing yet")} hint={tr("Reminders for dues, loans and your plan appear here.")} /> : (
          <ul className="divide-y">{data.data.map((n) => (
            <li key={n._id} className="flex items-start gap-3 p-4" onClick={() => !n.readAt && read.mutate(n._id)}>
              <span className={`mt-1.5 size-2 shrink-0 rounded-full ${n.readAt ? 'bg-transparent' : 'bg-primary'}`} />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium">{n.title}{n.level === 'hard' && <Badge tone="danger">{tr("Important")}</Badge>}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">{n.message}</p>
                <p className="mt-1 text-xs text-muted-foreground">{fmtDateTime(n.createdAt)}</p>
              </div>
            </li>
          ))}</ul>
        )}
        <Pager meta={data?.meta} onPage={setPage} />
      </Card>
    </>
  );
}
