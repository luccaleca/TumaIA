import Eyebrow from "./Eyebrow";

export default function SectionHeader({
  eyebrow,
  title,
  description,
  align = "left",
  light = false,
  className = "",
}) {
  const alignClass = align === "center" ? "mx-auto text-center items-center" : "text-left";
  return (
    <div className={`flex max-w-[60ch] flex-col gap-3 ${alignClass} ${className}`.trim()}>
      {eyebrow ? <Eyebrow light={light}>{eyebrow}</Eyebrow> : null}
      <h2
        className={[
          "text-balance font-[family-name:var(--font-display)] text-[clamp(2rem,1.3rem+2.4vw,3.25rem)] font-bold leading-[1.08] tracking-[-0.03em]",
          light ? "text-white" : "text-[var(--text)]",
        ].join(" ")}
      >
        {title}
      </h2>
      {description ? (
        <p
          className={[
            "text-pretty text-[1.0625rem] leading-[1.65]",
            light ? "text-white/75" : "text-[var(--muted)]",
          ].join(" ")}
        >
          {description}
        </p>
      ) : null}
    </div>
  );
}
