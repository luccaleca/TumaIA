export default function Badge({ children, className = "" }) {
  return (
    <span
      className={`inline-flex items-center rounded-full bg-[var(--brand-500)] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--ink-950)] ${className}`.trim()}
    >
      {children}
    </span>
  );
}
