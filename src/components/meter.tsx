import { tr } from '@/lib/lang';
import { num } from '@/lib/utils';

/** The shop's "electricity meter": a dial for today's load against its own busiest day, and an odometer for the total. */
export function MeterDial({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = max > 0 ? Math.min(1, value / max) : 0;
  const angle = -90 + pct * 180;
  const ticks = Array.from({ length: 11 }, (_, i) => i);
  return (
    <figure className="rounded-xl bg-[#0C1626] p-4 text-white">
      <svg viewBox="0 0 200 118" className="mx-auto w-full max-w-[260px]" role="img" aria-label={`${label}: ${value} of busiest ${max}`}>
        <path d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke="#223350" strokeWidth="10" strokeLinecap="round" />
        <path d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke="rgb(var(--meter))" strokeWidth="10" strokeLinecap="round" strokeDasharray={`${pct * 251.3} 251.3`} />
        {ticks.map((i) => {
          const a = ((-90 + i * 18) * Math.PI) / 180;
          const x1 = 100 + Math.sin(a) * 66, y1 = 100 - Math.cos(a) * 66, x2 = 100 + Math.sin(a) * (i % 5 === 0 ? 56 : 60), y2 = 100 - Math.cos(a) * (i % 5 === 0 ? 56 : 60);
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#6F86A8" strokeWidth={i % 5 === 0 ? 2 : 1} />;
        })}
        <g style={{ transform: `rotate(${angle}deg)`, transformOrigin: '100px 100px', transition: 'transform .8s cubic-bezier(.2,.8,.2,1)' }}>
          <line x1="100" y1="100" x2="100" y2="34" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
        </g>
        <circle cx="100" cy="100" r="6" fill="rgb(var(--meter))" />
      </svg>
      <figcaption className="-mt-1 text-center">
        <p className="num text-2xl font-semibold text-[rgb(var(--meter))]">{num(value)}</p>
        <p className="text-xs text-white/60">{label} {tr("· busiest day")} {num(max)}</p>
      </figcaption>
    </figure>
  );
}

export function Odometer({ value, label, digits = 6 }: { value: number; label: string; digits?: number }) {
  const s = String(Math.min(value, 10 ** digits - 1)).padStart(digits, '0');
  return (
    <div className="rounded-xl bg-[#0C1626] p-4 text-white">
      <div className="flex justify-center gap-1" role="img" aria-label={`${label}: ${value}`}>
        {s.split('').map((d, i) => (
          <span key={i} className="num grid h-11 w-7 place-items-center rounded bg-[#050B14] text-xl font-semibold text-[rgb(var(--meter))] shadow-inner ring-1 ring-white/10">{d}</span>
        ))}
      </div>
      <p className="mt-2 text-center text-xs text-white/60">{label}</p>
    </div>
  );
}
