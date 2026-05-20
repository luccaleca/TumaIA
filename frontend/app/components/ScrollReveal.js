"use client";

import { useEffect, useRef, useState } from "react";

const DIR_CLASS = {
  up: "landing-reveal-up",
  down: "landing-reveal-down",
  left: "landing-reveal-left",
  right: "landing-reveal-right",
  fade: "landing-reveal-fade",
  scale: "landing-reveal-scale",
};

/**
 * Animação ao entrar na viewport (scroll reveal).
 */
export default function ScrollReveal({
  children,
  className = "",
  delay = 0,
  direction = "up",
  as: Tag = "div",
}) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { threshold: 0.1, rootMargin: "0px 0px -8% 0px" },
    );

    io.observe(el);
    return () => io.disconnect();
  }, []);

  const dir = DIR_CLASS[direction] || DIR_CLASS.up;

  return (
    <Tag
      ref={ref}
      className={`landing-reveal ${dir} ${visible ? "landing-reveal-visible" : ""} ${className}`.trim()}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </Tag>
  );
}
