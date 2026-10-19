import Link from "next/link";

const variants = {
  primary:
    "bg-[var(--brand-500)] text-[var(--ink-950)] shadow-[var(--glow)] hover:opacity-95 hover:-translate-y-0.5",
  secondary:
    "border border-[var(--line)] bg-[var(--surface)] text-[var(--text)] hover:border-[var(--brand-500)]/50 hover:bg-[var(--surface-elevated)]",
  ghost:
    "border border-white/25 bg-white/10 text-white backdrop-blur-sm hover:bg-white/18",
  dark: "border border-[var(--line)] bg-[var(--ink-900)] text-white hover:bg-[var(--surface-elevated)]",
  outlineLight:
    "border border-white/35 bg-transparent text-white hover:bg-white/10",
};

const sizes = {
  md: "px-4 py-2.5 text-sm",
  lg: "px-5 py-3 text-[0.9375rem]",
};

export default function Button({
  children,
  href,
  variant = "primary",
  size = "md",
  className = "",
  icon,
  type = "button",
  onClick,
  ...rest
}) {
  const classes = [
    "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition duration-200 ease-[cubic-bezier(.22,.8,.2,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-500)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--paper)] active:scale-[0.98]",
    variants[variant] || variants.primary,
    sizes[size] || sizes.md,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const content = (
    <>
      {children}
      {icon ? <span className="inline-flex transition-transform group-hover:translate-x-0.5">{icon}</span> : null}
    </>
  );

  if (href) {
    const external = href.startsWith("http");
    if (external) {
      return (
        <a href={href} className={`group ${classes}`} {...rest}>
          {content}
        </a>
      );
    }
    return (
      <Link href={href} className={`group ${classes}`} {...rest}>
        {content}
      </Link>
    );
  }

  return (
    <button type={type} onClick={onClick} className={`group ${classes}`} {...rest}>
      {content}
    </button>
  );
}
