'use client';
import { tr } from '@/lib/lang';
import { useQuery } from '@tanstack/react-query';
import { Printer, Receipt } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { EmptyState, ListSkeleton, PageHeader, Pager, SearchBox } from '@/components/common';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Modal } from '@/components/ui/dialog';
import { Input, Select } from '@/components/ui/input';
import { TBody, TD, TH, THead, TR, Table } from '@/components/ui/table';
import { api, apiPaged, errMsg } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useAct, useDebounced } from '@/lib/hooks';
import { imeiList } from '@/lib/imei';
import { printInvoice } from '@/lib/print';
import type { Row } from '@/lib/types';
import { fmtDateTime, taka } from '@/lib/utils';

export default function SalesPage() {
  const { can, isOwner } = useAuth();
  const [search, setSearch] = useState('');
  const dq = useDebounced(search);
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<Row | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['sales', dq, status, from, to, page],
    queryFn: () =>
      apiPaged<Row>('/sales', {
        search: dq, status, page, limit: 20,
        from: from ? `${from}T00:00:00+06:00` : undefined,
        to: to ? `${to}T23:59:59+06:00` : undefined,
      }),
  });

  const cancel = useAct((id: string) => api(`/sales/${id}/cancel`, { method: 'POST' }), {
    ok: tr("Sale cancelled. Stock is back on the shelf."),
    keys: ['sales', 'products', 'dues', 'dashboard'],
    onOk: () => setOpen(null),
  });
  const print = async (id: string, f: 'pos' | 'a4') => {
    try { await printInvoice(id, f); } catch (e) { toast.error(errMsg(e)); }
  };

  return (
    <>
      <PageHeader title={tr("Sales")} description={can('sale.view_all') ? tr("Every sale in your shop.") : tr("The sales you made.")} />
      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b p-3">
          <SearchBox value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder={tr("Invoice, customer name or phone")} />
          <Select className="w-36" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label={tr("Status")}>
            <option value="">{tr("All sales")}</option><option value="completed">{tr("Completed")}</option><option value="cancelled">{tr("Cancelled")}</option>
          </Select>
          <Input type="date" className="w-40" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} aria-label={tr("From date")} />
          <Input type="date" className="w-40" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} aria-label={tr("To date")} />
        </div>
        {isLoading ? <ListSkeleton /> : !data?.data.length ? (
          <EmptyState icon={<Receipt />} title={tr("No sales found")} hint={tr("Change the filters, or make a sale from the Sell page.")} />
        ) : (
          <Table>
            <THead><TR><TH>{tr("Invoice")}</TH><TH>{tr("Date")}</TH><TH>{tr("Customer")}</TH><TH className="text-right">{tr("Total")}</TH><TH className="text-right">{tr("Due")}</TH>{isOwner && <TH className="text-right">{tr("Profit")}</TH>}<TH>{tr("Sold by")}</TH><TH /></TR></THead>
            <TBody>
              {data.data.map((s) => (
                <TR key={s._id} className="cursor-pointer" onClick={() => setOpen(s)}>
                  <TD className="font-medium">{s.invoiceNo} {s.status === 'cancelled' && <Badge tone="danger" className="ml-1">{tr("Cancelled")}</Badge>}{s.stockConflict && <Badge tone="warning" className="ml-1">{tr("Check stock")}</Badge>}</TD>
                  <TD className="whitespace-nowrap text-muted-foreground">{fmtDateTime(s.soldAt)}</TD>
                  <TD>{s.customer?.name || s.customer?.phone || <span className="text-muted-foreground">{tr("Walk-in")}</span>}</TD>
                  <TD className="num text-right font-medium">{taka(s.total)}</TD>
                  <TD className="num text-right">{s.dueAmount ? <span className="text-warning">{taka(s.dueAmount)}</span> : '-'}</TD>
                  {isOwner && <TD className="num text-right">{taka(s.shopProfit)}</TD>}
                  <TD className="text-muted-foreground">{s.soldByName}</TD>
                  <TD className="text-right"><Button size="sm" variant="ghost">{tr("View")}</Button></TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
        <Pager meta={data?.meta} onPage={setPage} />
      </Card>

      <Modal
        open={!!open}
        onOpenChange={(o) => !o && setOpen(null)}
        title={open?.invoiceNo ?? ''}
        description={open ? `${fmtDateTime(open.soldAt)} · ${open.soldByName ?? ''}` : ''}
        size="lg"
        footer={open && (
          <>
            {can('sale.cancel') && open.status === 'completed' && <Button variant="danger" className="mr-auto" loading={cancel.isPending} onClick={() => { if (confirm(tr("Cancel this sale? Stock goes back and any due is closed."))) cancel.mutate(open._id); }}>{tr("Cancel sale")}</Button>}
            <Button variant="outline" onClick={() => print(open._id, 'pos')}><Printer />{tr("Receipt")}</Button>
            <Button variant="outline" onClick={() => print(open._id, 'a4')}><Printer />{tr("A4")}</Button>
          </>
        )}
      >
        {open && (
          <div className="space-y-4">
            <Table>
              <THead><TR><TH>{tr("Item")}</TH><TH className="text-right">{tr("Qty")}</TH><TH className="text-right">{tr("Price")}</TH><TH className="text-right">{tr("Total")}</TH></TR></THead>
              <TBody>
                {(open.items as Row[]).map((i, k) => (
                  <TR key={k}><TD>{i.name}<span className="block text-xs text-muted-foreground">{i.barcode}{i.imei1 || i.imei2 ? ` · IMEI ${imeiList(i)}` : ''}</span></TD><TD className="num text-right">{i.quantity}</TD><TD className="num text-right">{i.listPrice > i.unitPrice && <span className="mr-1 text-xs text-muted-foreground line-through">{taka(i.listPrice)}</span>}{taka(i.unitPrice)}</TD><TD className="num text-right">{taka(i.lineTotal)}</TD></TR>
                ))}
              </TBody>
            </Table>
            <dl className="num ml-auto max-w-xs space-y-1 text-sm">
              <div className="flex justify-between"><dt className="text-muted-foreground">{tr("Subtotal")}</dt><dd>{taka(open.subTotal)}</dd></div>
              {open.discount > 0 && <div className="flex justify-between"><dt className="text-muted-foreground">{tr("Discount")}</dt><dd>-{taka(open.discount)}</dd></div>}
              {open.priceDiscount > 0 && <div className="flex justify-between"><dt className="text-muted-foreground">{tr("Price cut")}</dt><dd>-{taka(open.priceDiscount)}</dd></div>}
              {open.totalDiscount > 0 && <div className="flex justify-between font-medium text-success"><dt>{tr("Customer saved")}</dt><dd>{taka(open.totalDiscount)}</dd></div>}
              <div className="flex justify-between font-semibold"><dt>{tr("Total")}</dt><dd>{taka(open.total)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">{tr("Paid")}</dt><dd>{taka(open.paidAmount)}</dd></div>
              {open.dueAmount > 0 && <div className="flex justify-between text-warning"><dt>{tr("Due")}</dt><dd>{taka(open.dueAmount)}</dd></div>}
              {isOwner && open.supplierProfit > 0 && <div className="flex justify-between text-muted-foreground"><dt>{tr("Supplier’s profit")}</dt><dd>{taka(open.supplierProfit)}</dd></div>}
            </dl>
            {(open.customer?.name || open.customer?.phone) && <p className="text-sm text-muted-foreground">{tr("Customer:")} {open.customer.name} {open.customer.phone}</p>}
          </div>
        )}
      </Modal>
    </>
  );
}
