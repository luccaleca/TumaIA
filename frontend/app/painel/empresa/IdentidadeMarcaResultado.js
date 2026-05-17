"use client";

const INPUT_CLASS =
  "w-full rounded-xl border border-border bg-surface-elevated px-3 py-2.5 text-sm text-foreground shadow-sm outline-none transition-[border-color,box-shadow] focus:border-accent/55 focus:ring-2 focus:ring-accent/15 dark:focus:ring-accent/25 disabled:opacity-60";

/** [chave, rótulo, textarea?] */
const CAMPOS = [
  ["cor_primaria", "Cor primária", "color"],
  ["cor_secundaria", "Cor secundária", "color"],
  ["estilo_visual", "Estilo visual", false],
  ["tom_voz", "Tom de voz", false],
  ["sobre_empresa", "Sobre a empresa", true],
  ["segmento", "Segmento", false],
  ["publico", "Público-alvo", false],
  ["evitar", "Evitar nas artes", false],
  ["exemplo_frase_marca", "Frase de exemplo da marca", false],
];

function ColorField({ id, label, value, onChange, disabled }) {
  const hex = value && /^#/.test(value) ? value : "#6B2D9E";
  return (
    <div>
      <label htmlFor={`${id}-hex`} className="mb-1.5 block text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <div className="flex items-center gap-3">
        <label
          className="relative h-11 w-11 shrink-0 cursor-pointer overflow-hidden rounded-full shadow-sm ring-1 ring-black/10 dark:ring-white/15"
          style={{ backgroundColor: hex }}
        >
          <input
            id={`${id}-hex`}
            type="color"
            value={hex}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value.toUpperCase())}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            aria-label={label}
          />
        </label>
        <input
          id={id}
          type="text"
          value={value || ""}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#RRGGBB"
          className={`${INPUT_CLASS} flex-1 font-mono`}
        />
      </div>
    </div>
  );
}

/**
 * @param {{
 *   dados: Record<string, string>,
 *   canEdit: boolean,
 *   onFieldChange: (key: string, value: string) => void,
 *   visible: boolean,
 * }} props
 */
export default function IdentidadeMarcaResultado({ dados, canEdit, onFieldChange, visible }) {
  if (!visible) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-surface-elevated/30 px-4 py-8 text-center">
        <p className="text-sm font-medium text-foreground">Resultado da análise</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Depois de analisar suas fotos, a Tuma mostra aqui cores, estilo e tom sugeridos. Você pode revisar e
          alterar tudo antes de salvar.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-surface-elevated/50 p-4 sm:p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-foreground">Resultado da análise</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Sugestões da Tuma com base nas fotos. Ajuste qualquer campo — o que você mudar não será substituído na
          próxima análise.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {CAMPOS.filter(([, , t]) => t === "color").map(([key, label]) => (
          <ColorField
            key={key}
            id={key}
            label={label}
            value={dados[key]}
            disabled={!canEdit}
            onChange={(v) => onFieldChange(key, v)}
          />
        ))}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3">
        {CAMPOS.filter(([, , t]) => t !== "color").map(([key, label, area]) => (
          <div key={key}>
            <label htmlFor={`resultado-${key}`} className="mb-1.5 block text-xs font-medium text-muted-foreground">
              {label}
            </label>
            {area ? (
              <textarea
                id={`resultado-${key}`}
                value={dados[key]}
                disabled={!canEdit}
                onChange={(e) => onFieldChange(key, e.target.value)}
                className={`${INPUT_CLASS} min-h-20 resize-y`}
              />
            ) : (
              <input
                id={`resultado-${key}`}
                type="text"
                value={dados[key]}
                disabled={!canEdit}
                onChange={(e) => onFieldChange(key, e.target.value)}
                className={INPUT_CLASS}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

