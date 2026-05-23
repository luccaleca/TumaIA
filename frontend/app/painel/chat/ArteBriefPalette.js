"use client";

import { normalizeHexColor } from "../../../lib/identidadeMarcaUi";

const COR_PICKER_VAZIO = "#94A3B8";
const CORES_MAX = 5;

/**
 * @param {{
 *   cores: string[],
 *   brandColors?: string[],
 *   canEdit: boolean,
 *   onChange: (cores: string[]) => void,
 * }} props
 */
export default function ArteBriefPalette({ cores, brandColors = [], canEdit, onChange }) {
  const list = Array.isArray(cores) ? cores.filter((c) => normalizeHexColor(c)) : [];

  function updateAt(index, hex) {
    const next = [...list];
    const norm = normalizeHexColor(hex);
    if (!norm) return;
    next[index] = norm;
    onChange(next.slice(0, CORES_MAX));
  }

  function removeAt(index) {
    onChange(list.filter((_, i) => i !== index));
  }

  function addColor(hex) {
    const norm = normalizeHexColor(hex);
    if (!norm || list.includes(norm) || list.length >= CORES_MAX) return;
    onChange([...list, norm]);
  }

  function useBrandColors() {
    const brand = (brandColors || []).map(normalizeHexColor).filter(Boolean);
    if (!brand.length) return;
    onChange(brand.slice(0, CORES_MAX));
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">Cores</span>
        {canEdit && brandColors.length > 0 ? (
          <button
            type="button"
            className="text-xs font-medium text-accent hover:underline"
            onClick={useBrandColors}
          >
            Usar cores da marca
          </button>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {list.map((hex, i) => (
          <div
            key={`${hex}-${i}`}
            className="flex items-center gap-1 rounded-lg border border-border bg-surface-elevated/80 px-1.5 py-1"
          >
            <label
              className="relative h-9 w-9 shrink-0 cursor-pointer overflow-hidden rounded-full ring-1 ring-black/10 dark:ring-white/15"
              style={{ backgroundColor: hex }}
            >
              <input
                type="color"
                value={hex}
                disabled={!canEdit}
                onChange={(e) => updateAt(i, e.target.value)}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                aria-label={`Cor ${i + 1}`}
              />
            </label>
            <span className="font-mono text-[10px] text-muted-foreground">{hex}</span>
            {canEdit ? (
              <button
                type="button"
                className="px-1 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => removeAt(i)}
                aria-label="Remover cor"
              >
                ×
              </button>
            ) : null}
          </div>
        ))}
        {canEdit && list.length < CORES_MAX ? (
          <label className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-dashed border-border bg-muted/40 text-muted-foreground hover:border-accent/50">
            <span className="text-lg leading-none">+</span>
            <input
              type="color"
              className="sr-only"
              defaultValue={COR_PICKER_VAZIO}
              onChange={(e) => addColor(e.target.value)}
            />
          </label>
        ) : null}
      </div>
    </div>
  );
}
