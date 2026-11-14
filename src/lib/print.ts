/* eslint-disable @typescript-eslint/no-explicit-any */
import JsBarcode from 'jsbarcode';
import { apiText } from './api';

const openPrint = (html: string) => {
  const w = window.open('', '_blank', 'width=900,height=700');
  if (!w) throw new Error('Allow pop-ups to print');
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 350);
};

/** Invoice HTML comes from the server (pos = 80mm receipt, a4 = full invoice). */
export const printInvoice = async (saleId: string, format: 'pos' | 'a4') => {
  openPrint(await apiText(`/sales/${saleId}/invoice`, { format }));
};

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

/** Draws Code128 barcodes with JsBarcode and prints them as labels (each label repeated `copies` times). */
export const printLabels = (labels: { name: string; model?: string; barcode: string; salePrice?: number; copies: number }[], priceFmt: (p: number) => string) => {
  const cells: string[] = [];
  for (const l of labels) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    JsBarcode(svg, l.barcode, { format: 'CODE128', width: 1.6, height: 38, fontSize: 12, margin: 0, displayValue: true });
    for (let i = 0; i < l.copies; i++) {
      cells.push(
        `<div class="l"><div class="n">${esc(l.name)}${l.model ? ' · ' + esc(l.model) : ''}</div>${svg.outerHTML}${l.salePrice !== undefined ? `<div class="p">${esc(priceFmt(l.salePrice))}</div>` : ''}</div>`,
      );
    }
  }
  openPrint(`<!doctype html><html><head><meta charset="utf-8"><title>Barcode labels</title><style>
    @page{margin:8mm} body{font-family:system-ui,sans-serif;margin:0}
    .g{display:grid;grid-template-columns:repeat(auto-fill,minmax(52mm,1fr));gap:3mm}
    .l{border:1px dashed #bbb;padding:2mm;text-align:center;break-inside:avoid}
    .n{font-size:10px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .p{font-size:13px;font-weight:700}
    svg{max-width:100%;height:auto}
  </style></head><body><div class="g">${cells.join('')}</div></body></html>`);
};
