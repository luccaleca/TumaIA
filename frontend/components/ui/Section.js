import Container from "./Container";

const toneClass = {
  paper: "bg-[var(--paper)]",
  surface: "bg-[var(--surface)]",
  ink: "bg-[var(--ink-950)] text-white",
  transparent: "bg-transparent",
};

export default function Section({
  id,
  children,
  tone = "transparent",
  className = "",
  containerClassName = "",
  bare = false,
}) {
  const inner = bare ? children : <Container className={containerClassName}>{children}</Container>;
  return (
    <section
      id={id}
      className={`landing-section ${toneClass[tone] || toneClass.transparent} py-[clamp(4.5rem,8vw,8rem)] ${className}`.trim()}
    >
      {inner}
    </section>
  );
}
