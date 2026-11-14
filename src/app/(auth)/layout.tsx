'use client';
import { tr } from '@/lib/lang';
import { LanguageSwitch } from '@/lib/i18n';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <section className="relative hidden overflow-hidden bg-[#0C1626] p-10 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-lg bg-primary">
            <svg viewBox="0 0 64 64" className="size-5"><path d="M20 40a16 16 0 0 1 24 0M25 34a9 9 0 0 1 14 0" stroke="#fff" strokeWidth="5" fill="none" strokeLinecap="round" /><circle cx="32" cy="46" r="3.5" fill="#F2A900" /></svg>
          </span>
          <span className="font-semibold">{tr("Telecom Shop")}</span>
        </div>
        <div>
          <h2 className="max-w-md text-3xl font-semibold leading-tight">{tr("Every taka, every SIM, every due. One screen at your counter.")}</h2>
          <p className="mt-4 max-w-md text-white/70">{tr("Sell with a barcode scanner, keep bKash and Nagad balances right, collect what customers owe, and see which part of your shop really earns.")}</p>
          <dl className="mt-8 grid max-w-md grid-cols-3 gap-4 text-sm">
            {[['Works offline', 'Sales wait on your phone'], ['MFS ready', 'bKash, Nagad, Rocket, Upay'], ['Print', 'POS receipt or A4']].map(([a, b]) => (
              <div key={a}><dt className="font-medium">{a}</dt><dd className="mt-0.5 text-white/60">{b}</dd></div>
            ))}
          </dl>
        </div>
        <svg className="pointer-events-none absolute -bottom-24 -right-24 size-[420px] opacity-[0.12]" viewBox="0 0 200 200" fill="none" stroke="#fff" strokeWidth="2"><circle cx="100" cy="100" r="30" /><circle cx="100" cy="100" r="55" /><circle cx="100" cy="100" r="80" /><circle cx="100" cy="100" r="105" /></svg>
      </section>
      <section className="relative flex items-center justify-center p-5"><LanguageSwitch className="absolute right-4 top-4" />{children}</section>
    </div>
  );
}
