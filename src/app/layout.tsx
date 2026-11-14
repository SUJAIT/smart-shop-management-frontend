import type { Metadata, Viewport } from 'next';
import { Hind_Siliguri } from 'next/font/google';
import './globals.css';
import Providers from './providers';

// One family for Bangla and English so names, prices and notes never switch fonts mid-line.
const sans = Hind_Siliguri({ subsets: ['bengali', 'latin'], weight: ['400', '500', '600', '700'], variable: '--font-sans', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'Telecom Shop', template: '%s | Telecom Shop' },
  description: 'Sell, track e-balance, collect dues and watch your capital - one app for your mobile shop.',
  manifest: '/manifest.json',
  icons: { icon: '/icon.svg' },
};
export const viewport: Viewport = { themeColor: '#1D4FD8', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="bn" suppressHydrationWarning className={sans.variable}>
      <body className="min-h-dvh font-sans antialiased">
        <Providers>{children}</Providers>
        <script
          dangerouslySetInnerHTML={{
            __html: "if('serviceWorker' in navigator && location.hostname !== 'localhost'){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js').catch(function(){})})}",
          }}
        />
      </body>
    </html>
  );
}
