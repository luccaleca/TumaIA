"use client";

import { useEffect, useRef, useState } from "react";

type FadeInSectionProps = {
  children: React.ReactNode;
  className?: string;
  delayMs?: number;
};

export function FadeInSection({
  children,
  className,
  delayMs = 0,
}: FadeInSectionProps) {
  const ref = useRef<HTMLElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={ref}
      className={`transition-all duration-700 ease-out ${
        isVisible
          ? "translate-y-0 scale-100 opacity-100"
          : "translate-y-8 scale-[0.985] opacity-0"
      } ${className ?? ""}`}
      style={{ transitionDelay: `${delayMs}ms` }}
    >
      {children}
    </section>
  );
}
