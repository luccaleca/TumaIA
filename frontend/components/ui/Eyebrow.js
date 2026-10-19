export default function Eyebrow({ children, className = "", light = false }) {
  return (
    <p
      className={[
        "text-[0.8125rem] font-semibold uppercase tracking-[0.14em]",
        light ? "text-[var(--mint-300)]" : "text-[var(--brand-700)] dark:text-[var(--brand-400)]",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </p>
  );
}
