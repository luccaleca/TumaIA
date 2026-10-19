"use client";

import { useEffect, useState } from "react";

export function useActiveSection(ids, offset = 120) {
  const [activeId, setActiveId] = useState("");

  useEffect(() => {
    function update() {
      const y = window.scrollY + offset;
      let current = "";
      for (const id of ids) {
        const el = document.getElementById(id);
        if (!el) continue;
        if (el.offsetTop <= y) current = id;
      }
      setActiveId(current);
    }
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [ids, offset]);

  return activeId;
}
