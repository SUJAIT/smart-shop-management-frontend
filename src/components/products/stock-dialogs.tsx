'use client';
import { tmap, tr } from '@/lib/lang';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Field, ListSkeleton } from '@/components/common';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TBody, TD, TH, THead, TR, Table } from '@/components/ui/table';
import { api, apiPaged } from '@/lib/api';
import { useAct } from '@/lib/hooks';
import type { Row } from '@/lib/types';
import { fmtDateTime, taka, toPaisa } from '@/lib/utils';

/** Add stock (cost becomes the weighted average) or correct a wrong count. */
export function StockDialog({ product, onClose, canSeeCost }: { product: Row | null; onClose: () => void; canSeeCost: boolean }) {
  const [tab, setTab] = useState('add');
  const [qty, setQty] = useState('');
  const [boxes, setBoxes] = useState('');
  const [perBox, setPerBox] = useState('');
  const [cost, setCost] = useState('');
  const [price, setPrice] = useState('');
  const [note, setNote] = useState('');
  const [delta, setDelta] = useState('');

  useEffect(() => {
    if (!product) return;
    setTab('add'); setQty(''); setBoxes(''); setNote(''); setDelta('');
    setPerBox(product.piecesPerBox ? String(product.piecesPerBox) : '');
    setCost(''); setPrice('');
  }, [product]);

  const done = () => onClose();
  const add = useAct(
    () => {
      const body: Record<string, unknown> = { note: note.trim() || undefined, purchasePrice: toPaisa(cost), salePrice: toPaisa(price) };
      if (product?.productType === 'bulk' && boxes) { body.boxes = parseInt(boxes, 10); body.piecesPerBox = parseInt(perBox, 10) || undefined; }
      else body.quantity = parseInt(qty, 10);
      return api(`/products/${product!._id}/restock`, { method: 'POST', body });
    },
    { ok: tr("Stock added"), keys: ['products', 'capital', 'dashboard'], onOk: done },
  );
  const adjust = useAct(() => api(`/products/${product!._id}/adjust`, { method: 'POST', body: { delta: parseInt(delta, 10), note: note.trim() || undefined } }), { ok: tr("Count corrected"), keys: ['products', 'dashboard'], onOk: done });
  const unit = product?.unit === 'tk' ? 'taka' : 'pieces';

  return (
    <Modal open={!!product} onOpenChange={(o) => !o && onClose()} title={product?.name ?? ''} description={tr('In stock now: {n} {unit}', { n: product?.stock ?? 0, unit: tr(unit) })}>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList><TabsTrigger value="add">{tr("Add stock")}</TabsTrigger><TabsTrigger value="adjust">{tr("Correct count")}</TabsTrigger></TabsList>
        <TabsContent value="add" className="space-y-3 pt-4">
          {product?.productType === 'bulk' ? (
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label={tr("Boxes")}><Input value={boxes} onChange={(e) => setBoxes(e.target.value)} inputMode="numeric" /></Field>
              <Field label={tr("Pieces per box")}><Input value={perBox} onChange={(e) => setPerBox(e.target.value)} inputMode="numeric" /></Field>
              <Field label={tr("Or loose pieces")}><Input value={qty} onChange={(e) => setQty(e.target.value)} inputMode="numeric" disabled={!!boxes} /></Field>
            </div>
          ) : <Field label={tr('How many {unit}?', { unit: tr(unit) })}><Input value={qty} onChange={(e) => setQty(e.target.value)} inputMode="numeric" autoFocus /></Field>}
          <div className="grid gap-3 sm:grid-cols-2">
            {canSeeCost && <Field label={tr("Buying price this time (৳)")} hint={tr('Now {a}. The average cost updates by itself.', { a: taka(product?.purchasePrice) })}><Input value={cost} onChange={(e) => setCost(e.target.value)} inputMode="decimal" /></Field>}
            <Field label={tr("New selling price (optional)")}><Input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" placeholder={String((product?.salePrice ?? 0) / 100)} /></Field>
          </div>
          <Field label={tr("Note (optional)")}><Input value={note} onChange={(e) => setNote(e.target.value)} /></Field>
          <div className="flex justify-end"><Button loading={add.isPending} disabled={!qty && !boxes} onClick={() => add.mutate(undefined)}>{tr("Add stock")}</Button></div>
        </TabsContent>
        <TabsContent value="adjust" className="space-y-3 pt-4">
          <Field label={tr("Change by")} hint={tr("Use a minus for lost or damaged items, like -2. This does not touch your capital.")}><Input value={delta} onChange={(e) => setDelta(e.target.value)} inputMode="numeric" placeholder={tr("-2 or 5")} /></Field>
          <Field label={tr("Why? (optional)")}><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={tr("Damaged, counting mistake…")} /></Field>
          <div className="flex justify-end"><Button loading={adjust.isPending} disabled={!parseInt(delta, 10)} onClick={() => adjust.mutate(undefined)}>{tr("Save count")}</Button></div>
        </TabsContent>
      </Tabs>
    </Modal>
  );
}

export function HistoryDialog({ product, onClose }: { product: Row | null; onClose: () => void }) {
  const { data, isLoading } = useQuery({ queryKey: ['movements', product?._id], queryFn: () => apiPaged<Row>(`/products/${product!._id}/movements`, { limit: 50 }), enabled: !!product });
  const label: Record<string, string> = tmap({ purchase: 'Bought', sale: 'Sold', return: 'Returned', adjust: 'Corrected' });
  return (
    <Modal open={!!product} onOpenChange={(o) => !o && onClose()} title={tr('Stock history: {name}', { name: product?.name ?? '' })} size="lg">
      {isLoading ? <ListSkeleton rows={4} /> : !data?.data.length ? <p className="py-6 text-center text-sm text-muted-foreground">{tr("Nothing recorded yet.")}</p> : (
        <Table>
          <THead><TR><TH>{tr("When")}</TH><TH>{tr("What")}</TH><TH className="text-right">{tr("Qty")}</TH><TH className="text-right">{tr("Unit cost")}</TH><TH>{tr("Note")}</TH></TR></THead>
          <TBody>{data.data.map((m) => (
            <TR key={m._id}><TD className="whitespace-nowrap text-muted-foreground">{fmtDateTime(m.createdAt)}</TD><TD>{label[m.type] ?? m.type}</TD><TD className={`num text-right ${m.quantity < 0 ? 'text-danger' : 'text-success'}`}>{m.quantity > 0 ? '+' : ''}{m.quantity}</TD><TD className="num text-right">{m.unitCost ? taka(m.unitCost) : '-'}</TD><TD className="text-muted-foreground">{m.note}</TD></TR>
          ))}</TBody>
        </Table>
      )}
    </Modal>
  );
}
