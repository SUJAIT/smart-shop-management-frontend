/**
 * IMEI helpers for phones. A phone can have IMEI 1 and IMEI 2, each one either
 * the full 15 digits or just the last 4 digits, and both can be left empty.
 */
export type ImeiState = 'empty' | 'full' | 'last4' | 'partial';

/** Keeps digits only, at most 15. */
export const cleanImei = (v: string) => v.replace(/\D/g, '').slice(0, 15);

export const imeiState = (v?: string | null): ImeiState => {
  const t = (v ?? '').trim();
  if (!t) return 'empty';
  if (/^\d{15}$/.test(t)) return 'full';
  if (/^\d{4}$/.test(t)) return 'last4';
  return 'partial'; // 1-3 or 5-14 digits: not accepted
};

/** Luhn check digit of a full IMEI. Used only for a soft "double check" hint, never to block saving. */
export const luhnOk = (v: string) => {
  let sum = 0;
  for (let i = 0; i < v.length; i++) {
    let d = Number(v[v.length - 1 - i]);
    if (i % 2 === 1) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
  }
  return sum % 10 === 0;
};

/** Shown on screens and invoices: a last-4 entry reads \u2022\u2022\u2022\u2022 1234 so nobody mistakes it for a whole IMEI. */
export const imeiText = (v: string) => (v.length === 4 ? `\u2022\u2022\u2022\u2022 ${v}` : v);

/** "IMEI 1 / IMEI 2" for a product or a sale line, empty when the phone has none. */
export const imeiList = (p: { imei1?: string | null; imei2?: string | null }) =>
  [p.imei1, p.imei2].filter((x): x is string => !!x).map(imeiText).join(' / ');

/** Same rule as the server: equal numbers clash, and last 4 digits clash with a full IMEI that ends with them. */
export const imeiClash = (a?: string | null, b?: string | null) =>
  !!a && !!b && (a === b || (a.length === 4 && b.length === 15 && b.endsWith(a)) || (b.length === 4 && a.length === 15 && a.endsWith(b)));
