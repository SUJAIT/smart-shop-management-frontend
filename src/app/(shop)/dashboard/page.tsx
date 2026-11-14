'use client';
import { tr } from '@/lib/lang';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { EmptyState, Kpi, PageHeader, ProviderMark, chartColor } from '@/components/common';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { SECTOR_LABEL, SECTORS } from '@/lib/labels';
import type { Row } from '@/lib/types';
import { fmtDate, num, taka } from '@/lib/utils';

export default function DashboardPage() {
  const { isOwner } = useAuth();
  const { data: d, isLoading } = useQuery({ queryKey: ['dashboard'], queryFn: () => api<Row>('/dashboard'), enabled: isOwner, refetchInterval: 60_000 });

  if (!isOwner) return <EmptyState title={tr("The dashboard is for the shop owner")} hint={tr("Open Sell to make a sale.")} />;
  if (isLoading || !d) return <div className="space-y-4"><Skeleton className="h-36" /><Skeleton className="h-64" /></div>;

  const chart = (d.sectorReport.series as Row[]).map((s) => ({
    month: s.month.slice(5) + '/' + s.month.slice(2, 4),
    ...Object.fromEntries(SECTORS.map((k) => [k, Math.round((s.sectors[k] ?? 0) / 100)])),
  }));
  const hasProfit = chart.some((c) => SECTORS.some((k) => (c as Row)[k] !== 0));
  const t = d.today;
  const m = d.thisMonth;

  return (
    <>
      <PageHeader title={tr("Dashboard")} description={tr("What your shop earned and what is waiting for you.")} />

      {/* The one figure an owner checks first: profit today, with what it is made of */}
      <Card className="mb-4 overflow-hidden">
        <div className="grid divide-y sm:grid-cols-[1.3fr_1fr_1fr_1fr] sm:divide-x sm:divide-y-0">
          <CardContent className="bg-primary/[0.06]">
            <Kpi label={tr("Profit today")} value={taka(t.totalProfit)} tone={t.totalProfit < 0 ? 'danger' : undefined} sub={tr('{a} sales · {b} MFS entries', { a: num(t.sales.count), b: num(t.mfs.count) })} />
          </CardContent>
          <CardContent><Kpi label={tr("Sales today")} value={taka(t.sales.revenue)} sub={tr('Collected {a}', { a: taka(t.sales.collected) })} /></CardContent>
          <CardContent><Kpi label={tr("MFS profit today")} value={taka(t.mfs.profit)} sub={tr('Volume {a}', { a: taka(t.mfs.volume) })} /></CardContent>
          <CardContent><Kpi label={tr("Left unpaid today")} value={taka(t.sales.due)} tone={t.sales.due ? 'warning' : undefined} sub="Credit sales" /></CardContent>
        </div>
        <div className="grid divide-y border-t sm:grid-cols-[1.3fr_1fr_1fr_1fr] sm:divide-x sm:divide-y-0">
          <CardContent><Kpi label={tr("Profit this month")} value={taka(m.totalProfit)} /></CardContent>
          <CardContent><Kpi label={tr("Sales this month")} value={taka(m.sales.revenue)} sub={tr('{n} sales', { n: num(m.sales.count) })} /></CardContent>
          <CardContent><Kpi label={tr("MFS this month")} value={taka(m.mfs.profit)} sub={tr('{n} entries', { n: num(m.mfs.count) })} /></CardContent>
          <CardContent><Kpi label={tr("Customers owe you")} value={taka(d.dues.totalDue)} tone={d.dues.overdueCount ? 'danger' : undefined} sub={d.dues.overdueCount ? tr('{n} overdue · {a}', { n: d.dues.overdueCount, a: taka(d.dues.overdueAmount) }) : tr('{n} open', { n: d.dues.count })} /></CardContent>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader><CardTitle>{tr("Profit by sector, last 6 months")}</CardTitle></CardHeader>
          <CardContent>
            {hasProfit ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chart} margin={{ left: -10, right: 4, top: 8 }}>
                    <CartesianGrid vertical={false} stroke="rgb(var(--border))" />
                    <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} stroke="rgb(var(--muted-foreground))" />
                    <YAxis tickLine={false} axisLine={false} fontSize={12} stroke="rgb(var(--muted-foreground))" tickFormatter={(v) => (Math.abs(v) >= 1000 ? `${v / 1000}k` : String(v))} />
                    <Tooltip formatter={(v: number, n: string) => [taka(v * 100), SECTOR_LABEL[n] ?? n]} contentStyle={{ background: 'rgb(var(--card))', border: '1px solid rgb(var(--border))', borderRadius: 8, fontSize: 13 }} cursor={{ fill: 'rgb(var(--muted))' }} />
                    <Legend formatter={(n) => SECTOR_LABEL[n] ?? n} iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                    {SECTORS.map((k, i) => <Bar key={k} dataKey={k} stackId="p" fill={chartColor(i + 1)} />)}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState title={tr("No profit recorded yet")} hint={tr("Make a sale or an MFS entry and the sector chart fills in.")} action={<Button asChild><Link href="/sell">{tr("Make a sale")}</Link></Button>} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{tr("Capital")}</CardTitle>
            <Button asChild size="sm" variant="outline"><Link href="/capital">{tr("Open")}</Link></Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {d.capital.capitalTracking === null && <p className="rounded-md bg-muted p-3 text-sm">{tr("Capital tracking is not set up yet. Add your capital to see your balance and returns.")}</p>}
            <div className="grid grid-cols-2 gap-4">
              <Kpi label={tr("Total capital")} value={taka(d.capital.netCapital)} />
              <Kpi label={tr("Left after stock")} value={taka(d.capital.capitalBalance)} tone={d.capital.capitalBalance < 0 ? 'danger' : undefined} />
              <Kpi label={tr("Stock value (cost)")} value={taka(d.capital.remainingStockValue)} sub={tr('{n} units', { n: num(d.capital.remainingStockUnits) })} />
              <Kpi label={tr("Loan interest / month")} value={taka(d.capital.liabilities.monthlyLoanInterest)} />
            </div>
            {d.sectorReport.currentMonthRoi.length > 0 && (
              <div>
                <p className="mb-1.5 text-[13px] text-muted-foreground">{tr("Return this month on money given to each sector")}</p>
                <ul className="divide-y rounded-md border">
                  {(d.sectorReport.currentMonthRoi as Row[]).map((r) => (
                    <li key={r.sector} className="flex items-center justify-between px-3 py-2 text-sm">
                      <span>{SECTOR_LABEL[r.sector]}</span>
                      <span className="num flex items-center gap-3">
                        <span className="text-muted-foreground">{taka(r.profit)}</span>
                        <Badge tone={r.roiPct === null ? 'neutral' : r.roiPct >= 0 ? 'success' : 'danger'}>{r.roiPct === null ? '-' : `${r.roiPct}%`}</Badge>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>{tr("E-balance now")}</CardTitle><Button asChild size="sm" variant="outline"><Link href="/mfs">{tr("MFS")}</Link></Button></CardHeader>
          <CardContent className="pt-3">
            {d.mfsAccounts.length === 0 ? <p className="text-sm text-muted-foreground">{tr("No SR accounts yet. Add one on the MFS page.")}</p> : (
              <ul className="divide-y">
                {(d.mfsAccounts as Row[]).map((a) => (
                  <li key={a._id} className="flex items-center gap-3 py-2.5">
                    <ProviderMark k={a.provider} name={a.provider} />
                    <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium capitalize">{a.provider}</p><p className="truncate text-xs text-muted-foreground">{tr("SR")} {a.srName}</p></div>
                    <p className="num text-sm font-semibold">{taka(a.balance)}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{tr("Running low")}</CardTitle><Button asChild size="sm" variant="outline"><Link href="/products?lowStock=true">{tr("All")}</Link></Button></CardHeader>
          <CardContent className="pt-3">
            {d.lowStock.length === 0 ? <p className="text-sm text-muted-foreground">{tr("Every product has enough stock.")}</p> : (
              <ul className="divide-y">
                {(d.lowStock as Row[]).map((p) => (
                  <li key={p._id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <span className="min-w-0 truncate">{p.name}</span>
                    <Badge tone={p.stock === 0 ? 'danger' : 'warning'}>{p.stock === 0 ? tr("Out") : tr('{n} left', { n: p.stock })}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-2 xl:col-span-1">
          <CardHeader><CardTitle>{tr("Supplier share this month")}</CardTitle></CardHeader>
          <CardContent className="pt-3">
            {d.supplierShare.length === 0 ? <p className="text-sm text-muted-foreground">{tr("No supplier-product sales this month.")}</p> : (
              <ul className="divide-y">
                {(d.supplierShare as Row[]).map((s) => (
                  <li key={s.supplier} className="py-2.5 text-sm">
                    <div className="flex justify-between"><span className="font-medium">{s.supplier}</span><span className="text-muted-foreground">{num(s.unitsSold)} {tr("sold")}</span></div>
                    <div className="num mt-0.5 flex justify-between text-[13px]"><span>{tr("You keep")} <b>{taka(s.shopProfit)}</b></span><span>{tr("Supplier gets")} <b>{taka(s.supplierProfit)}</b></span></div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
      <p className="mt-4 text-xs text-muted-foreground">{tr("Updated")} {fmtDate(new Date())}{tr(". Profit counts only your share; supplier profit is kept separate.")}</p>
    </>
  );
}
