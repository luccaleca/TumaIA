"use client";

/** Contêiner com brilho que segue o cursor (só em dispositivos com mouse). */
export default function Spot({ as: Tag = "div", className = "", children, ...rest }) {
  function onMove(e) {
    if (e.pointerType !== "mouse") return;
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
  }
  return (
    <Tag className={`lp-spot ${className}`.trim()} onPointerMove={onMove} {...rest}>
      {children}
    </Tag>
  );
}
