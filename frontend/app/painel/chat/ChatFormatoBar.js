"use client";

import { useEffect, useState } from "react";
import { normalizeArteBrief } from "../../../lib/arteFormatPresets";
import FormatoPresetPicker from "./FormatoPresetPicker";

/**
 * Barra colapsável acima do campo de mensagem — seletor de proporção.
 *
 * @param {{
 *   brief: Record<string, unknown>,
 *   brandColors?: string[],
 *   disabled?: boolean,
 *   onBriefChange: (brief: Record<string, unknown>) => void,
 *   collapseStorageKey?: string,
 * }} props
 */
export default function ChatFormatoBar({
  brief: briefIn,
  brandColors = [],
  disabled,
  onBriefChange,
  collapseStorageKey,
}) {
  const brief = normalizeArteBrief(briefIn, brandColors);
  const f = brief.formato || {};

  const [collapsed, setCollapsed] = useState(true);

  useEffect(() => {
    if (!collapseStorageKey || typeof window === "undefined") return;
    try {
      const stored = sessionStorage.getItem(collapseStorageKey);
      setCollapsed(stored === null ? true : stored === "1");
    } catch {
      /* ignore */
    }
  }, [collapseStorageKey]);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      if (collapseStorageKey) {
        try {
          sessionStorage.setItem(collapseStorageKey, next ? "1" : "0");
        } catch {
          /* ignore */
        }
      }
      return next;
    });
  }

  function patch(partial) {
    onBriefChange(normalizeArteBrief({ ...brief, ...partial }, brandColors));
  }

  const summaryLabel = [f.label, f.subtitle].filter(Boolean).join(" · ") || "Post";

  return (
    <div className="border-b border-border/60 bg-muted/25">
      {!collapsed ? (
        <div className="flex justify-center border-b border-border/40 px-3 pb-3 pt-2.5 md:px-4">
          <FormatoPresetPicker
            value={brief.formato}
            disabled={disabled}
            onChange={(preset) =>
              patch({
                formato: {
                  preset_id: preset.id,
                  ratio: preset.ratio,
                  label: preset.label,
                  subtitle: preset.subtitle,
                  pixels: preset.pixels,
                  orientation: preset.orientation,
                },
              })
            }
          />
        </div>
      ) : null}

      <div className="flex justify-center px-3 py-2 md:px-4">
        <button
          type="button"
          disabled={disabled}
          onClick={toggleCollapsed}
          className="inline-flex max-w-full items-center gap-2 rounded-full border border-border/80 bg-background/80 px-3 py-1.5 text-center shadow-sm transition-colors hover:bg-muted/60 disabled:opacity-50"
          aria-expanded={!collapsed}
          aria-label={collapsed ? "Expandir seletor de formato" : "Minimizar seletor de formato"}
        >
          <span className="text-sm font-semibold text-foreground">Formato</span>
          <span className="inline-flex items-center rounded-full border border-border bg-muted/50 px-2 py-0.5 text-[11px] font-medium text-foreground">
            {f.ratio || "1:1"}
          </span>
          <span className="truncate text-xs text-muted-foreground">{summaryLabel}</span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${collapsed ? "rotate-180" : ""}`}
            aria-hidden
          >
            <path
              fillRule="evenodd"
              d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
