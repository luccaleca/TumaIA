export default function PhoneFrame({ children, className = "" }) {
  return (
    <div className={`relative mx-auto w-full max-w-[280px] ${className}`.trim()}>
      <div className="rounded-[2.75rem] border border-white/15 bg-[linear-gradient(160deg,#1a1f1c,#0a100d)] p-[10px] shadow-[0_28px_60px_-24px_rgba(6,18,12,0.55)]">
        <div className="relative overflow-hidden rounded-[2.1rem] bg-[var(--ink-950)] ring-1 ring-white/10">
          <div
            className="pointer-events-none absolute left-1/2 top-0 z-20 h-[22px] w-[34%] -translate-x-1/2 rounded-b-2xl bg-black/90"
            aria-hidden
          />
          <div className="relative aspect-[9/16] w-full overflow-hidden bg-[#0b1510]">{children}</div>
        </div>
      </div>
    </div>
  );
}
