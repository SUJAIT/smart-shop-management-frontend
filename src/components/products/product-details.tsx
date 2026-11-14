'use client';
import { tr } from '@/lib/lang';
import { useQuery } from '@tanstack/react-query';
import { History, Package, PackagePlus, Pencil } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/dialog';
import { api } from '@/lib/api';
import { imeiText } from '@/lib/imei';
import { PRODUCT_TYPE_LABEL, catName, warrantyText } from '@/lib/labels';
import type { Row } from '@/lib/types';
import { fmtDateTime, taka, thumb } from '@/lib/utils';

const Line = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="flex items-start justify-between gap-4 py-2 text-sm">
    <dt className="shrink-0 text-muted-foreground">{label}</dt>
    <dd className="num text-right font-medium">{children}</dd>
  </div>
);
const Group = ({ title, children }: { title: string; children: ReactNode }) => (
  <section>
    <h3 className="mb-1 text-[13px] font-semibold text-muted-foreground">{title}</h3>
    <dl className="divide-y rounded-lg border px-3">{children}</dl>
  </section>
);

/** Everything about one product: pictures, buying price, profit, supplier, and when it was added. */
export function ProductDetails({
  product: p,
  canSeeCost,
  onClose,
  onEdit,
  onStock,
  onHistory,
}: {
  product: Row | null;
  canSeeCost: boolean;
  onClose: () => void;
  onEdit?: (p: Row) => void;
  onStock?: (p: Row) => void;
  onHistory?: (p: Row) => void;
}) {
  const [idx, setIdx] = useState(0);
  const { data: tree = [] } = useQuery({ queryKey: ['categories', 'tree'], queryFn: () => api<Row[]>('/categories', { query: { tree: true } }), enabled: !!p });
  const names: Record<string, string> = {};
  tree.forEach((c) => {
    names[c._id] = catName(c.name);
    (c.children ?? []).forEach((s: Row) => (names[s._id] = catName(s.name)));
  });

  if (!p) return <Modal open={false} onOpenChange={onClose} title="">{null}</Modal>;

  const images: Row[] = p.images ?? [];
  const img = images[Math.min(idx, Math.max(images.length - 1, 0))];
  const profit = (p.salePrice ?? 0) - (p.purchasePrice ?? 0);
  const unit = p.unit === 'tk' ? 'taka' : 'pcs';
  const sup = p.supplier;
  const supShare = sup ? Math.round((profit * (sup.supplierSharePct ?? 0)) / 100) : 0;
  const addedBy = p.createdByName ?? p.createdBy?.name;
  const low = p.stock <= (p.lowStockAlert ?? 0);

  return (
    <Modal
      open
      onOpenChange={(o) => { if (!o) { setIdx(0); onClose(); } }}
      size="lg"
      title={p.name}
      description={[p.brand, p.model].filter(Boolean).join(' · ') || undefined}
      footer={
        <>
          {onHistory && <Button variant="ghost" className="mr-auto" onClick={() => onHistory(p)}><History />{tr("Stock history")}</Button>}
          {onStock && <Button variant="outline" onClick={() => onStock(p)}><PackagePlus />{tr("Add stock")}</Button>}
          {onEdit && <Button onClick={() => onEdit(p)}><Pencil />{tr("Edit")}</Button>}
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex gap-4">
          <div className="w-36 shrink-0 sm:w-44">
            {img ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={thumb(img.url, 360)} alt={p.name} className="aspect-square w-full rounded-lg border bg-muted object-contain" />
            ) : (
              <div className="grid aspect-square w-full place-items-center rounded-lg bg-muted text-muted-foreground"><Package className="size-8" /></div>
            )}
            {images.length > 1 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {images.map((i, k) => (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <button key={i.publicId ?? k} onClick={() => setIdx(k)} aria-label={tr('Picture {n}', { n: k + 1 })} className={`overflow-hidden rounded-md border ${k === idx ? 'ring-2 ring-primary' : ''}`}>
                    <img src={thumb(i.url, 64)} alt="" className="size-9 object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap gap-1.5">
              <Badge tone="primary">{PRODUCT_TYPE_LABEL[p.productType]}</Badge>
              {!p.isActive && <Badge>{tr("Hidden")}</Badge>}
              <Badge tone={p.stock === 0 ? 'danger' : low ? 'warning' : 'success'}>{p.stock === 0 ? tr("Out of stock") : low ? tr("Low stock") : tr("In stock")}</Badge>
            </div>
            <p className="num text-2xl font-semibold">{taka(p.salePrice)}{!(p.salePrice > 0) && <span className="ml-2 text-sm font-normal text-warning">{tr("No selling price yet")}</span>}</p>
            <p className="text-sm text-muted-foreground">{tr("Stock:")} <b className="num text-foreground">{p.stock} {unit}</b></p>
            {p.description && <p className="whitespace-pre-wrap text-sm">{p.description}</p>}
          </div>
        </div>

        {canSeeCost && (
          <Group title={tr("Money")}>
            <Line label={tr("Buying price (original)")}>{taka(p.purchasePrice)}</Line>
            <Line label={tr("Selling price")}>{taka(p.salePrice)}</Line>
            <Line label={tr("Profit on each")}>
              <span className={profit < 0 ? 'text-danger' : 'text-success'}>{taka(profit)}</span>
              {p.purchasePrice > 0 && <span className="ml-1 text-xs font-normal text-muted-foreground">({Math.round((profit / p.purchasePrice) * 100)}%)</span>}
            </Line>
            <Line label={tr("Money in the stock you have (at cost)")}>{taka((p.purchasePrice ?? 0) * p.stock)}</Line>
          </Group>
        )}

        <Group title={tr("Product")}>
          <Line label={tr("Category")}>{[names[p.categoryId], p.subCategoryId && names[p.subCategoryId]].filter(Boolean).join(' › ') || '-'}</Line>
          {p.barcode && <Line label={tr("Barcode")}>{p.barcode}</Line>}
          {p.imei1 && <Line label={tr("IMEI 1")}>{imeiText(p.imei1)}{p.imei1.length === 4 && <span className="ml-1 text-xs font-normal text-muted-foreground">{tr("Last 4 digits")}</span>}</Line>}
          {p.imei2 && <Line label={tr("IMEI 2")}>{imeiText(p.imei2)}{p.imei2.length === 4 && <span className="ml-1 text-xs font-normal text-muted-foreground">{tr("Last 4 digits")}</span>}</Line>}
          {p.productType === 'bulk' && p.piecesPerBox ? <Line label={tr("Pieces in a box")}>{p.piecesPerBox}</Line> : null}
          <Line label={tr("Low-stock warning at")}>{p.lowStockAlert ?? '-'}</Line>
          {p.card && (
            <>
              <Line label={tr("Card kind")}>{p.card.kind}</Line>
              {p.card.dataMB ? <Line label={tr("Data")}>{p.card.dataMB} {tr("MB")}</Line> : null}
              {p.card.minutes ? <Line label={tr("Minutes")}>{p.card.minutes}</Line> : null}
              {p.card.validityDays ? <Line label={tr("Valid for")}>{p.card.validityDays} {tr("days")}</Line> : null}
              {p.card.cardPrice ? <Line label={tr("Card price")}>{taka(p.card.cardPrice)}</Line> : null}
            </>
          )}
        </Group>

        {canSeeCost && sup && (sup.name || sup.phone || sup.supplierSharePct !== undefined) && (
          <Group title={tr("Supplier")}>
            {sup.name && <Line label={tr("Name")}>{sup.name}</Line>}
            {sup.phone && <Line label={tr("Phone")}><a href={`tel:${sup.phone}`} className="text-primary hover:underline">{sup.phone}</a></Line>}
            {sup.address && <Line label={tr("Address")}>{sup.address}</Line>}
            <Line label={tr("Supplier’s share of profit")}>{sup.supplierSharePct}%</Line>
            <Line label={tr("On each sale")}>{tr("You keep")} {taka(profit - supShare)} {tr("· Supplier")} {taka(supShare)}</Line>
          </Group>
        )}

        {p.productType !== 'operator' && (

          <Group title={tr('Warranty')}>

            <Line label={p.warranty?.kind === 'guarantee' ? tr('Guarantee') : tr('Warranty')}>{warrantyText(p.warranty)}</Line>

            {p.warranty?.enabled && p.warranty.note ? <Line label={tr('Note')}>{p.warranty.note}</Line> : null}

          </Group>

        )}

        <Group title={tr("Record")}>
          <Line label={tr("Added on")}>{fmtDateTime(p.createdAt)}</Line>
          {addedBy && <Line label={tr("Added by")}>{addedBy}</Line>}
          <Line label={tr("Last changed")}>{fmtDateTime(p.updatedAt)}</Line>
        </Group>
      </div>
    </Modal>
  );
}
