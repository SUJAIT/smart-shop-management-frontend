/* Language core with no React in it, so utils / labels / print can use it too.
   English text is the key: tr('Save') -> 'সংরক্ষণ' when Bangla is on, and the English text itself when a translation is missing. */
import { bn } from './bn';
import { bn2 } from './bn2';

export type Lang = 'en' | 'bn';
let current: Lang = 'en';
export const getLang = () => current;
export const setLangValue = (l: Lang) => {
  current = l;
};

const BN_DIGITS = '০১২৩৪৫৬৭৮৯';
/** 1,25,000 -> ১,২৫,০০০ (Bangla mode only) */
export const digits = (s: string) => (current === 'bn' ? s.replace(/\d/g, (d) => BN_DIGITS[Number(d)]) : s);

export function tr(text: string, vars?: Record<string, string | number | undefined>): string {
  if (!text) return text;
  let out = text;
  if (current === 'bn') {
    const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(text);
    const lead = m?.[1] ?? '';
    const core = m?.[2] ?? text;
    const trail = m?.[3] ?? '';
    const hit = bn2?.[core] ?? bn?.[core]; // never crash if a dictionary is not loaded yet (stale dev cache)
    if (hit) out = lead + hit + trail;
  }
  if (vars) out = out.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''));
  return out;
}

/** A lookup table whose values are translated every time they are read (safe for module-level constants). */
export function tmap<T extends Record<string, string>>(obj: T): T {
  return new Proxy(obj, {
    get: (o, k) => (typeof k === 'string' && k in o ? tr(o[k]) : (o as never)[k]),
  });
}
