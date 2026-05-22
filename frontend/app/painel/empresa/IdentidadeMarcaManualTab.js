"use client";

import IdentidadeMarcaCoresExtras from "./IdentidadeMarcaCoresExtras";

const INPUT_CLASS =
  "w-full rounded-xl border border-border bg-surface-elevated px-3 py-2.5 text-sm text-foreground shadow-sm outline-none transition-[border-color,box-shadow] focus:border-accent/55 focus:ring-2 focus:ring-accent/15 dark:focus:ring-accent/25 disabled:opacity-60";

/** [chave, placeholder, textarea?] */
const CAMPOS_MARCA = [
  ["sobre_empresa", "Sobre a empresa", true],
  ["segmento", "Segmento", false],
  ["tom_voz", "Tom de voz", false],
  ["estilo_visual", "Estilo visual (sem nomes de cor)", false],
  ["publico", "Público-alvo", false],
  ["evitar", "Evitar nas artes", false],
  ["exemplo_frase_marca", "Frase de exemplo", false],
];

const COR_PICKER_VAZIO = "#94A3B8";

function ColorField({ id, ariaLabel, value, onChange, disabled }) {
  const hex = value && /^#/.test(value) ? value : COR_PICKER_VAZIO;
  return (
    <div className="flex items-center gap-3">
      <label
        className="relative h-11 w-11 shrink-0 cursor-pointer overflow-hidden rounded-full shadow-sm ring-1 ring-black/10 dark:ring-white/15"
        style={{ backgroundColor: hex }}
      >
        <input
          id={id}
          type="color"
          value={hex}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          aria-label={ariaLabel}
        />
      </label>
      <input
        type="text"
        value={value || ""}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        placeholder="#RRGGBB"
        className={`${INPUT_CLASS} flex-1 font-mono`}
        aria-label={ariaLabel}
      />
    </div>
  );
}

/**
 * @param {{
 *   dados: Record<string, string>,
 *   canEdit: boolean,
 *   onFieldChange: (key: string, value: string) => void,
 * }} props
 */
export default function IdentidadeMarcaManualTab({ dados, canEdit, onFieldChange }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Preencha ou corrija tudo à mão, sem usar fotos. Útil se você já sabe a identidade da marca ou prefere não
        enviar imagens. Campos editados aqui não são sobrescritos quando você analisa novas fotos na outra aba.
      </p>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <ColorField
          id="cor_primaria"
          ariaLabel="Cor primária"
          value={dados.cor_primaria}
          disabled={!canEdit}
          onChange={(v) => onFieldChange("cor_primaria", v)}
        />
        <ColorField
          id="cor_secundaria"
          ariaLabel="Cor secundária"
          value={dados.cor_secundaria}
          disabled={!canEdit}
          onChange={(v) => onFieldChange("cor_secundaria", v)}
        />
      </div>

      <IdentidadeMarcaCoresExtras
        cores={dados.cores_adicionais}
        canEdit={canEdit}
        onChange={(cores) => onFieldChange("cores_adicionais", cores)}
      />

      <div className="grid grid-cols-1 gap-3">
        {CAMPOS_MARCA.map(([key, placeholder, area]) =>
          area ? (
            <textarea
              key={key}
              id={key}
              value={dados[key]}
              disabled={!canEdit}
              onChange={(e) => onFieldChange(key, e.target.value)}
              placeholder={placeholder}
              className={`${INPUT_CLASS} min-h-20 resize-y`}
            />
          ) : (
            <input
              key={key}
              id={key}
              type="text"
              value={dados[key]}
              disabled={!canEdit}
              onChange={(e) => onFieldChange(key, e.target.value)}
              placeholder={placeholder}
              className={INPUT_CLASS}
            />
          ),
        )}
      </div>

      <div className="border-t border-border pt-4">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Opcional</p>
        <label htmlFor="legenda_referencia_manual" className="mb-1.5 block text-xs font-medium text-muted-foreground">
          Legenda de referência
        </label>
        <textarea
          id="legenda_referencia_manual"
          value={dados.legenda_referencia}
          disabled={!canEdit}
          onChange={(e) => onFieldChange("legenda_referencia", e.target.value)}
          placeholder="Texto de um post de referência (opcional)"
          className={`${INPUT_CLASS} min-h-16 resize-y`}
        />
      </div>
    </div>
  );
}



