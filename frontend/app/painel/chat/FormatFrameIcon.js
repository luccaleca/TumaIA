/**
 * Ícone de moldura (celular quadrado, vertical, deitado) para o seletor de formato.
 *
 * @param {{ orientation: string, className?: string }} props
 */
export default function FormatFrameIcon({ orientation, className = "" }) {
  const o = String(orientation || "square");
  let w = 14;
  let h = 14;
  if (o === "portrait_tall") {
    w = 10;
    h = 18;
  } else if (o === "portrait") {
    w = 12;
    h = 16;
  } else if (o === "landscape_wide") {
    w = 20;
    h = 11;
  } else if (o === "landscape") {
    w = 18;
    h = 12;
  }

  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      className={className}
      aria-hidden
    >
      <rect
        x="1"
        y="1"
        width={w - 2}
        height={h - 2}
        rx="2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      {o === "portrait_tall" || o === "portrait" ? (
        <rect x={w * 0.35} y={h * 0.2} width={w * 0.3} height={h * 0.12} rx="0.5" fill="currentColor" opacity="0.35" />
      ) : null}
    </svg>
  );
}
