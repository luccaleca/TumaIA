"use client";

import { CORES_ADICIONAIS_MAX, normalizeHexColor } from "../../../lib/identidadeMarcaUi";

const INPUT_CLASS =
  "w-full rounded-xl border border-border bg-surface-elevated px-3 py-2.5 text-sm text-foreground shadow-sm outline-none transition-[border-color,box-shadow] focus:border-accent/55 focus:ring-2 focus:ring-accent/15 dark:focus:ring-accent/25 disabled:opacity-60";

const COR_PICKER_VAZIO = "#94A3B8";

/**
 * @param {{
 *   cores: string[],
 *   canEdit: boolean,
 *   onChange: (cores: string[]) => void,
 * }} props
 */
export default function IdentidadeMarcaCoresExtras({ cores, canEdit, onChange }) {
  const list = Array.isArray(cores) ? cores.filter((c) => normalizeHexColor(c)) : [];

  function updateAt(index, hex) {
    const next = [...list];
    const norm = normalizeHexColor(hex);
    if (!norm) return;
    next[index] = norm;
    onChange(next.slice(0, CORES_ADICIONAIS_MAX));
  }

  function removeAt(index) {
    onChange(list.filter((_, i) => i !== index));
  }

  function addColor(hex) {
    const norm = normalizeHexColor(hex);
    if (!norm || list.includes(norm) || list.length >= CORES_ADICIONAIS_MAX) return;
    onChange([...list, norm]);
  }

  return (
    <div>
      <p className="mb-2 text-xs font-medium text-muted-foreground">Outras cores da marca</p>
      <div className="flex flex-wrap items-center gap-2">
        {list.map((hex, i) => (
          <div key={`${hex}-${i}`} className="flex items-center gap-1 rounded-lg border border-border bg-surface-elevated/80 px-1.5 py-1">
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
                aria-label={`Cor ${i + 3}`}
              />
            </label>
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
        {canEdit && list.length < CORES_ADICIONAIS_MAX ? (
          <label
            className="relative flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-dashed border-border text-lg text-muted-foreground"
            style={{ backgroundColor: COR_PICKER_VAZIO }}
            title="Adicionar cor"
          >
            +
            <input
              type="color"
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              defaultValue={COR_PICKER_VAZIO}
              onChange={(e) => addColor(e.target.value)}
              aria-label="Adicionar cor"
            />
          </label>
        ) : null}
      </div>
      {canEdit && list.length < CORES_ADICIONAIS_MAX ? (
        <input
          type="text"
          placeholder="#RRGGBB"
          className={`${INPUT_CLASS} mt-2 max-w-[10rem] font-mono text-xs`}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            addColor(e.currentTarget.value);
            e.currentTarget.value = "";
          }}
          onBlur={(e) => {
            if (!e.target.value.trim()) return;
            addColor(e.target.value);
            e.target.value = "";
          }}
        />
      ) : null}
    </div>
  );
}
