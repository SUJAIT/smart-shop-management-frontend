'use client';
import { tr } from '@/lib/lang';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Kpi, PageHeader } from '@/components/common';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { Row } from '@/lib/types';
import { num, taka } from '@/lib/utils';

export default function AdminHome() {
  const { can } = useAuth();
  const { data: d } = useQuery({ queryKey: ['admin', 'dashboard'], queryFn: () => api<Row>('/super-admin/dashboard'), enabled: can('shop.view') });
  if (!can('shop.view')) return <PageHeader title={tr("Control room")} description={tr("Use the menu to open the parts you have access to.")} />;
  if (!d) return <Skeleton className="h-60" />;
  return (
    <>
      <PageHeader title={tr("Control room")} description={tr("All shops at a glance.")} />
      <Card className="mb-4"><div className="grid grid-cols-2 divide-x divide-y lg:grid-cols-4 lg:divide-y-0">
        <CardContent><Kpi label={tr("Active shops")} value={num(d.shops.active)} sub={tr('{a} blocked · {b} new this month', { a: num(d.shops.blocked), b: num(d.shops.newThisMonth) })} /></CardContent>
        <CardContent><Kpi label={tr("Using the app today")} value={num(d.shops.activeToday)} sub={tr('{n} plans end within 7 days', { n: num(d.shops.expiringIn7Days) })} /></CardContent>
        <CardContent><Kpi label={tr("Revenue this month")} value={taka(d.revenue.thisMonth)} sub={tr('All time {a}', { a: taka(d.revenue.total) })} /></CardContent>
        <CardContent><Kpi label={tr("Unread chats")} value={num(d.unreadChats)} tone={d.unreadChats ? 'warning' : undefined} sub={<Link href="/admin/chat" className="text-primary hover:underline">{tr("Open inbox")}</Link>} /></CardContent>
      </div></Card>
      <Card>
        <CardHeader><CardTitle>{tr("Busiest shops, last 7 days")}</CardTitle><Button asChild size="sm" variant="outline"><Link href="/admin/shops">{tr("All shops")}</Link></Button></CardHeader>
        <CardContent>
          <p className="mb-2 text-[13px] text-muted-foreground">{tr("Units = things saved: every sale, product and entry. Use this to decide who needs a paid plan.")}</p>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={d.topUsageLast7Days} layout="vertical" margin={{ left: 10, right: 10 }}>
                <CartesianGrid horizontal={false} stroke="rgb(var(--border))" />
                <XAxis type="number" tickLine={false} axisLine={false} fontSize={12} stroke="rgb(var(--muted-foreground))" />
                <YAxis type="category" dataKey="name" width={120} tickLine={false} axisLine={false} fontSize={12} stroke="rgb(var(--muted-foreground))" />
                <Tooltip contentStyle={{ background: 'rgb(var(--card))', border: '1px solid rgb(var(--border))', borderRadius: 8, fontSize: 13 }} cursor={{ fill: 'rgb(var(--muted))' }} />
                <Bar dataKey="writes" name="Units" fill="rgb(var(--chart-1))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
