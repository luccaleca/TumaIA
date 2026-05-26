"use client";

import { useState } from "react";
import IdentidadeMarcaCoresExtras from "./IdentidadeMarcaCoresExtras";
import IdentidadeMarcaPresetChips from "./IdentidadeMarcaPresetChips";
import {
  CAMPOS_IMAGEM_OPCIONAIS,
  CAMPOS_PADROES_VISUAIS,
  CAMPOS_IMAGEM_PRINCIPAIS,
  EVITAR_PADRAO_IMAGEM,
} from "../../../lib/identidadeMarcaPresets";

const INPUT_CLASS =
  "w-full rounded-xl border border-border bg-surface-elevated px-3 py-2.5 text-sm text-foreground shadow-sm outline-none transition-[border-color,box-shadow] focus:border-accent/55 focus:ring-2 focus:ring-accent/15 dark:focus:ring-accent/25 disabled:opacity-60";

const COR_PICKER_VAZIO = "#94A3B8";

function ColorField({ id, label, value, onChange, disabled }) {
  const hex = value && /^#/.test(value) ? value : COR_PICKER_VAZIO;
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

function CampoTexto({ campo, dados, canEdit, onFieldChange, idPrefix = "" }) {
  const value = dados[campo.key] || "";
  const inputId = `${idPrefix}${campo.key}`;

  return (
    <div>
      <label htmlFor={inputId} className="mb-1 block text-xs font-medium text-foreground">
        {campo.label}
      </label>
      {campo.hint ? <p className="mb-1.5 text-[11px] leading-snug text-muted-foreground">{campo.hint}</p> : null}
      {campo.multiline ? (
        <textarea
          id={inputId}
          value={value}
          disabled={!canEdit}
          onChange={(e) => onFieldChange(campo.key, e.target.value)}
          placeholder={campo.placeholder}
          className={`${INPUT_CLASS} min-h-20 resize-y`}
        />
      ) : (
        <input
          id={inputId}
          type="text"
          value={value}
          disabled={!canEdit}
          onChange={(e) => onFieldChange(campo.key, e.target.value)}
          placeholder={campo.placeholder}
          className={INPUT_CLASS}
        />
      )}
      {campo.presets?.length ? (
        <IdentidadeMarcaPresetChips
          presets={campo.presets}
          disabled={!canEdit}
          onSelect={(v) => onFieldChange(campo.key, v)}
        />
      ) : null}
    </div>
  );
}

/**
 * @param {{
 *   dados: Record<string, unknown>,
 *   canEdit: boolean,
 *   onFieldChange: (key: string, value: string | string[]) => void,
 *   intro?: string | null,
 *   showOpcional?: boolean,
 *   showLegenda?: boolean,
 *   idPrefix?: string,
 * }} props
 */
export default function IdentidadeMarcaCamposImagem({
  dados,
  canEdit,
  onFieldChange,
  intro,
  showOpcional = true,
  showLegenda = false,
  idPrefix = "",
}) {
  const [opcionalOpen, setOpcionalOpen] = useState(false);

  return (
    <div className="space-y-5">
      {intro ? <p className="text-sm text-muted-foreground">{intro}</p> : null}

      <section className="rounded-xl border border-border bg-muted/10 p-4 sm:p-5">
        <h3 className="text-sm font-semibold text-foreground">Para artes no Tuma</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Logo, paleta e estilo guiam a geração de imagens. Clique nas sugestões ou edite à mão.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <ColorField
            id={`${idPrefix}cor_primaria`}
            label="Cor primária"
            value={String(dados.cor_primaria || "")}
            disabled={!canEdit}
            onChange={(v) => onFieldChange("cor_primaria", v)}
          />
          <ColorField
            id={`${idPrefix}cor_secundaria`}
            label="Cor secundária"
            value={String(dados.cor_secundaria || "")}
            disabled={!canEdit}
            onChange={(v) => onFieldChange("cor_secundaria", v)}
          />
        </div>

        <div className="mt-3">
          <IdentidadeMarcaCoresExtras
            cores={dados.cores_adicionais}
            canEdit={canEdit}
            onChange={(cores) => onFieldChange("cores_adicionais", cores)}
          />
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4">
          {CAMPOS_IMAGEM_PRINCIPAIS.map((campo) => (
            <CampoTexto
              key={campo.key}
              campo={campo}
              dados={dados}
              canEdit={canEdit}
              onFieldChange={onFieldChange}
              idPrefix={idPrefix}
            />
          ))}
        </div>

        <div className="mt-5 rounded-xl border border-border/70 bg-background/60 p-4">
          <h4 className="text-sm font-semibold text-foreground">Padrões visuais aprendidos</h4>
          <p className="mt-1 text-xs text-muted-foreground">
            Aqui o Tuma guarda o DNA visual da marca. O sistema salva o detalhe, mas resume isso num prompt curto na
            hora de gerar a arte.
          </p>

          <div className="mt-4 grid grid-cols-1 gap-4">
            {CAMPOS_PADROES_VISUAIS.map((campo) => (
              <CampoTexto
                key={campo.key}
                campo={campo}
                dados={dados}
                canEdit={canEdit}
                onFieldChange={onFieldChange}
                idPrefix={idPrefix}
              />
            ))}
          </div>
        </div>

        {!String(dados.evitar || "").trim() && canEdit ? (
          <button
            type="button"
            className="mt-3 text-xs font-medium text-accent hover:underline"
            onClick={() => onFieldChange("evitar", EVITAR_PADRAO_IMAGEM)}
          >
            Usar sugestão padrão de «Evitar»
          </button>
        ) : null}
      </section>

      {showOpcional ? (
        <section className="rounded-xl border border-dashed border-border/80">
          <button
            type="button"
            onClick={() => setOpcionalOpen((v) => !v)}
            className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <span>Contexto extra (chat e legendas)</span>
            <span aria-hidden>{opcionalOpen ? "▾" : "▸"}</span>
          </button>
          {opcionalOpen ? (
            <div className="space-y-4 border-t border-border px-4 pb-4 pt-3">
              {CAMPOS_IMAGEM_OPCIONAIS.map((campo) => (
                <CampoTexto
                  key={campo.key}
                  campo={campo}
                  dados={dados}
                  canEdit={canEdit}
                  onFieldChange={onFieldChange}
                  idPrefix={idPrefix}
                />
              ))}
              {showLegenda ? (
                <CampoTexto
                  campo={{
                    key: "legenda_referencia",
                    label: "Legenda de referência",
                    hint: "Texto de um post antigo — só para análise, não vai direto na arte.",
                    placeholder: "Opcional",
                    multiline: true,
                  }}
                  dados={dados}
                  canEdit={canEdit}
                  onFieldChange={onFieldChange}
                  idPrefix={idPrefix}
                />
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
