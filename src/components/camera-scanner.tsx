'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { tr } from '@/lib/lang';
import { Camera } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { normalizeCode } from '@/lib/scanner';
import { Button } from './ui/button';
import { Modal } from './ui/dialog';

const FORMATS = ['code_128', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_39', 'qr_code'];

/** ZXing reader: works in every browser. Only the common shop barcode types, so it is fast and rarely wrong. */
async function makeReader() {
  const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([import('@zxing/browser'), import('@zxing/library')]);
  const hints = new Map<any, any>([
    [DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.CODE_128, BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E, BarcodeFormat.CODE_39, BarcodeFormat.QR_CODE]],
    [DecodeHintType.TRY_HARDER, true],
  ]);
  return new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 100 });
}

/**
 * Open the camera and scan. Nothing else to press.
 * It uses the browser's own fast barcode reader when there is one, and ZXing everywhere else.
 * The camera needs https or localhost (browser rule). Only if the camera really cannot start,
 * a small "take a photo" link appears as a backup. USB / Bluetooth scanners never use this dialog.
 */
export function CameraScanner({ open, onOpenChange, onCode }: { open: boolean; onOpenChange: (o: boolean) => void; onCode: (code: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const photo = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const [live, setLive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [canLive, setCanLive] = useState(true);

  // latest callbacks in refs, so the camera is not restarted when the page re-renders
  const cbs = useRef({ onCode, onOpenChange });
  cbs.current = { onCode, onOpenChange };
  const done = useCallback((raw: string) => {
    const code = normalizeCode(raw);
    if (!code) return;
    cbs.current.onCode(code);
    cbs.current.onOpenChange(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    setError('');
    setLive(false);
    const ok = window.isSecureContext && !!navigator.mediaDevices?.getUserMedia;
    setCanLive(ok);
    if (!ok) return;

    let stopped = false;
    let stream: MediaStream | undefined;
    let zx: { stop: () => void } | undefined;
    let timer: number | undefined;

    const fail = (e: any) => {
      if (stopped) return;
      setError(e?.name === 'NotAllowedError' || e?.name === 'SecurityError'
        ? tr('The camera was blocked. Allow the camera for this site in the browser, or take a photo of the barcode.')
        : tr('The camera could not start. You can take a photo of the barcode instead.'));
    };

    const startZxing = async () => {
      const reader = await makeReader();
      if (stopped || !video.current) return;
      zx = await reader.decodeFromConstraints({ video: { facingMode: { ideal: 'environment' } } }, video.current, (result) => {
        if (result && !stopped) { stopped = true; zx?.stop(); done(result.getText()); }
      });
      if (stopped) zx?.stop();
      else setLive(true);
    };

    (async () => {
      try {
        const Native = (window as any).BarcodeDetector;
        let detector: any;
        if (Native) {
          try { detector = new Native({ formats: FORMATS }); } catch { detector = undefined; }
        }
        if (!detector) return await startZxing();

        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } } });
        if (stopped || !video.current) return;
        video.current.srcObject = stream;
        await video.current.play();
        setLive(true);
        const tick = async () => {
          if (stopped || !video.current) return;
          try {
            const found = await detector.detect(video.current);
            if (found[0]?.rawValue) { stopped = true; done(found[0].rawValue); return; }
          } catch { /* keep trying */ }
          timer = window.setTimeout(tick, 150);
        };
        void tick();
      } catch (e) {
        fail(e);
      }
    })();

    return () => {
      stopped = true;
      window.clearTimeout(timer);
      zx?.stop();
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [open, done]);

  // backup only: the phone's own camera app takes a picture of the barcode
  const fromPhoto = async (file?: File | null) => {
    if (!file) return;
    setBusy(true);
    setError('');
    const url = URL.createObjectURL(file);
    try {
      const result = await (await makeReader()).decodeFromImageUrl(url);
      done(result.getText());
    } catch {
      setError(tr('Could not read a barcode in that photo. Hold the phone steady, closer to the barcode, with good light, and try again.'));
    } finally {
      URL.revokeObjectURL(url);
      setBusy(false);
      if (photo.current) photo.current.value = '';
    }
  };

  const showBackup = !canLive || !!error;
  return (
    <Modal open={open} onOpenChange={onOpenChange} title={tr('Scan barcode')} description={showBackup ? tr('Take a photo of the barcode.') : tr('Hold the barcode inside the frame.')} size="sm">
      <div className="space-y-3">
        {!showBackup && (
          <div className="relative overflow-hidden rounded-lg bg-black">
            <video ref={video} className="aspect-[4/3] w-full object-cover" muted playsInline />
            <div className="pointer-events-none absolute inset-x-[10%] inset-y-[28%] rounded-lg border-2 border-white/70" aria-hidden />
            {!live && <p className="absolute inset-0 grid place-items-center text-sm text-white/80">{tr('Starting the camera…')}</p>}
          </div>
        )}
        {!canLive && <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">{tr('Live camera needs a secure (https) address, and this page is not on one. You can still scan: take a photo of the barcode.')}</p>}
        {error && <p className="rounded-lg bg-danger/10 p-3 text-sm text-danger" role="alert">{error}</p>}

        {showBackup && (
          <>
            <input ref={photo} type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => void fromPhoto(e.target.files?.[0])} />
            <Button className="w-full" loading={busy} onClick={() => photo.current?.click()}><Camera />{tr('Take a photo of the barcode')}</Button>
          </>
        )}
      </div>
    </Modal>
  );
}
