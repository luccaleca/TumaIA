import Link from "next/link";
import Icon from "./Icons";

export function Button({
  href,
  variant = "primary",
  size = "md",
  icon,
  external = false,
  children,
  className = "",
  ...rest
}) {
  const cls = `lp-btn lp-btn--${variant} lp-btn--${size} ${className}`.trim();
  const content = (
    <>
      <span>{children}</span>
      {icon ? <Icon name={icon} size={size === "lg" ? 20 : 18} className="lp-btn__icon" /> : null}
    </>
  );
  if (!href) {
    return (
      <button type="button" className={cls} {...rest}>
        {content}
      </button>
    );
  }
  if (external || href.startsWith("#")) {
    return (
      <a href={href} className={cls} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})} {...rest}>
        {content}
      </a>
    );
  }
  return (
    <Link href={href} className={cls} {...rest}>
      {content}
    </Link>
  );
}

export function Section({ id, tone = "white", className = "", children, ...rest }) {
  return (
    <section id={id} className={`lp-section lp-section--${tone} ${className}`.trim()} {...rest}>
      <div className="lp-container">{children}</div>
    </section>
  );
}

export function SectionHeader({ eyebrow, title, text, align = "left", titleId, onDark = false }) {
  return (
    <header className={`lp-sh lp-sh--${align} ${onDark ? "lp-sh--dark" : ""}`.trim()}>
      <p className="lp-eyebrow">{eyebrow}</p>
      <h2 id={titleId} className="lp-h2">
        {title}
      </h2>
      {text ? <p className="lp-lead">{text}</p> : null}
    </header>
  );
}
