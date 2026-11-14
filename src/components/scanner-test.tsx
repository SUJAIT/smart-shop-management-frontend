'use client';
import { tr } from '@/lib/lang';
import { Camera, CheckCircle2, ScanBarcode } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useBarcodeScanner, type ScanInfo } from '@/lib/scanner';
import { fmtTime } from '@/lib/utils';
import { CameraScanner } from './camera-scanner';

/** "Is my scanner connected?" Scan anything, and see what the app received. */
export function ScannerTest() {
  const [scans, setScans] = useState<{ code: string; at: Date; info: ScanInfo }[]>([]);
  const [camera, setCamera] = useState(false);
  const [secure, setSecure] = useState(true);
  useEffect(() => setSecure(window.isSecureContext && !!navigator.mediaDevices?.getUserMedia), []);

  useBarcodeScanner((code, info) => setScans((s) => [{ code, at: new Date(), info }, ...s].slice(0, 6)));

  return (
    <>
      <Card>
        <CardHeader><div><CardTitle>{tr('Barcode scanner')}</CardTitle><CardDescription>{tr('USB, Bluetooth and wireless scanners work with no setup. Plug it in, then scan any barcode here to test.')}</CardDescription></div></CardHeader>
        <CardContent className="space-y-3">
          <div
            tabIndex={0}
            onClick={() => (document.activeElement as HTMLElement | null)?.blur()}
            className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed p-6 text-center focus:border-primary focus:outline-none"
          >
            {scans.length ? <CheckCircle2 className="size-8 text-success" /> : <ScanBarcode className="size-8 text-muted-foreground" />}
            <p className="font-medium">{scans.length ? tr('Your scanner works.') : tr('Waiting for a scan…')}</p>
            <p className="text-[13px] text-muted-foreground">{tr('Click here, then scan a barcode.')}</p>
          </div>
          {scans.length > 0 && (
            <ul className="divide-y rounded-lg border text-sm">
              {scans.map((s, i) => (
                <li key={i} className="flex items-center justify-between gap-3 px-3 py-2">
                  <span className="num truncate font-semibold">{s.code}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{fmtTime(s.at)} · {s.info.chars} {tr('characters')} · {s.info.ms} ms · {s.info.ender === 'none' ? tr('no end key') : s.info.ender}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><div><CardTitle>{tr('Phone camera')}</CardTitle><CardDescription>{secure ? tr('The camera can scan barcodes live.') : tr('Live camera needs a secure (https) address. You can still scan by taking a photo of the barcode.')}</CardDescription></div></CardHeader>
        <CardContent><Button variant="outline" onClick={() => setCamera(true)}><Camera />{tr('Test the camera')}</Button></CardContent>
      </Card>
    <CameraScanner
  open={camera}
  onOpenChange={setCamera}
  onCode={(c) =>
    setScans((s) =>
      [{ code: c, at: new Date(), info: { chars: c.length, ms: 0, ender: 'none' as const } }, ...s].slice(0, 6)
    )
  }
/>
    </>
  );
}
