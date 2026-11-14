'use client';
import { useEffect, useRef, type RefObject } from 'react';

const BN_DIGITS = '০১২৩৪৫৬৭৮৯';

/** Clean up what a scanner typed: Bangla digits -> 0-9 (if the PC keyboard is on Bangla), no spaces or hidden characters. */
export const normalizeCode = (s: string) =>
  s.replace(/[০-৯]/g, (d) => String(BN_DIGITS.indexOf(d))).replace(/[\s\u200b-\u200d\ufeff]/g, '').trim();

export interface ScanInfo {
  chars: number;
  ms: number; // how long the scanner took to "type" the code
  ender: 'Enter' | 'Tab' | 'none'; // the key the scanner sends at the end
}

const isEditable = (el: Element | null) =>
  !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || (el as HTMLElement).isContentEditable);

/**
 * Works with every USB, Bluetooth and wireless barcode scanner that acts like a keyboard (almost all of them).
 * A scanner "types" the whole code in a few milliseconds and presses Enter (or Tab), a person never types that fast.
 * So we can tell them apart, and the scan works even when no box is selected.
 *
 * - `inputRef`: the search box. If nothing is selected, the scan is sent there.
 * - `onConsumed`: called when a scan was caught, so the page can clear the text the scanner typed into the box.
 */
export function useBarcodeScanner(
  onScan: (code: string, info: ScanInfo) => void,
  opts: { enabled?: boolean; inputRef?: RefObject<HTMLInputElement>; onConsumed?: () => void } = {},
) {
  const cb = useRef(onScan);
  cb.current = onScan;
  const { enabled = true, inputRef, onConsumed } = opts;

  useEffect(() => {
    if (!enabled) return;
    let buf = '';
    let first = 0;
    let last = 0;
    let fast = 0;
    let timer: number | undefined;
    const reset = () => { buf = ''; first = 0; last = 0; fast = 0; };

    const finish = (ender: ScanInfo['ender'], e?: KeyboardEvent) => {
      window.clearTimeout(timer);
      const code = normalizeCode(buf);
      const burst = code.length >= 4 && fast >= Math.max(3, Math.floor((buf.length - 1) * 0.8));
      const info: ScanInfo = { chars: code.length, ms: Math.round(last - first), ender };
      reset();
      if (!burst) return false;
      e?.preventDefault();
      e?.stopPropagation();
      onConsumed?.();
      cb.current(code, info);
      return true;
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const target = document.activeElement;
      const onSearch = !!inputRef?.current && target === inputRef.current;
      if (isEditable(target) && !onSearch) { reset(); return; } // the person is typing in another box
      if (e.key === 'Enter' || e.key === 'Tab') {
        if (buf) finish(e.key, e);
        return;
      }
      if (e.key.length !== 1) return;
      const now = performance.now();
      if (buf && now - last > 60) reset(); // a pause means a person is typing: start over
      if (!buf) first = now;
      else if (now - last <= 50) fast++;
      last = now;
      buf += e.key;
      if (!isEditable(target) && inputRef?.current) inputRef.current.focus(); // nothing selected: the search box takes it
      window.clearTimeout(timer);
      // some scanners send no Enter at all: a fast burst that stops by itself is a scan too
      timer = window.setTimeout(() => { if (buf.length >= 6) finish('none'); else reset(); }, 90);
    };

    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.clearTimeout(timer);
    };
  }, [enabled, inputRef, onConsumed]);
}
