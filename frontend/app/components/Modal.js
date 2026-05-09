"use client";

import { useEffect } from "react";

export default function Modal({ open, onClose, title, maxWidthClass = "max-w-md", children }) {
  useEffect(() => {
    if (!open) return;
    function onKeyDown(ev) {
      if (ev.key === "Escape") onClose?.();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 dark:bg-black/55" onClick={onClose}>
      <section
        className={`w-full ${maxWidthClass} rounded-xl border border-border bg-surface p-5 shadow-lg`}
        onClick={(ev) => ev.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
          >
            Fechar
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
