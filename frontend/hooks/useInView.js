"use client";

import { useEffect, useRef, useState } from "react";

export function useInView(options = {}) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          if (options.once !== false) io.disconnect();
        } else if (options.once === false) {
          setInView(false);
        }
      },
      { threshold: options.threshold ?? 0.15, rootMargin: options.rootMargin ?? "0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [options.once, options.threshold, options.rootMargin]);

  return [ref, inView];
}
