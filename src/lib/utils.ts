import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { digits, getLang } from './lang';

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

/** Money is stored as integer paisa. Shown with lakh grouping: ৳1,25,000 */
export const taka = (paisa: number | undefined | null, opts: { sign?: boolean } = {}) => {
  const p = paisa ?? 0;
  const neg = p < 0;
  const abs = Math.abs(p);
  const hasFraction = abs % 100 !== 0;
  const s = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(abs / 100);
  return `${neg ? '-' : opts.sign && p > 0 ? '+' : ''}৳${digits(s)}`;
};

/** "120.50" typed by the user -> 12050 paisa. Empty / invalid -> undefined. */
export const toPaisa = (v: string | number | undefined | null): number | undefined => {
  if (v === '' || v === undefined || v === null) return undefined;
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? Math.round(n * 100) : undefined;
};
export const fromPaisa = (p: number | undefined | null) => (p === undefined || p === null ? '' : String(p / 100));

export const num = (n: number | undefined | null) => digits(new Intl.NumberFormat('en-IN').format(n ?? 0));

const dtf = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(getLang() === 'bn' ? 'bn-BD' : 'en-GB', { timeZone: 'Asia/Dhaka', numberingSystem: getLang() === 'bn' ? 'beng' : 'latn', ...o });
export const fmtDate = (d?: string | Date | null) => (d ? dtf({ day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(d)) : '-');
export const fmtDateTime = (d?: string | Date | null) =>
  d ? dtf({ day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true }).format(new Date(d)) : '-';
export const fmtTime = (d?: string | Date | null) => (d ? dtf({ hour: '2-digit', minute: '2-digit', hour12: true }).format(new Date(d)) : '');
export const toInputDate = (d?: string | Date | null) => (d ? new Date(d).toISOString().slice(0, 10) : '');
export const addDaysInput = (days: number) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);

export const uuid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
      });

export const initials = (name?: string) =>
  (name ?? '?').split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');

/** Small, light picture for lists (Cloudinary resizes it for us). */
export const thumb = (url?: string, size = 96) =>
  url && url.includes('/upload/') ? url.replace('/upload/', `/upload/w_${size},h_${size},c_fill,q_auto,f_auto/`) : url;
