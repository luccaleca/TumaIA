"use client";

import { useState } from "react";
import IdentidadeMarcaCoresExtras from "./IdentidadeMarcaCoresExtras";
import IdentidadeMarcaPresetChips from "./IdentidadeMarcaPresetChips";
import {
  EVITAR_PADRAO_IMAGEM,
  PRESETS_ESTILO_VISUAL,
  PRESETS_EVITAR,
} from "../../../lib/identidadeMarcaPresets";

const INPUT_CLASS =
  "w-full rounded-xl border border-border bg-surface-elevated px-3 py-2.5 text-sm text-foreground shadow-sm outline-none transition-[border-color,box-shadow] focus:border-accent/55 focus:ring-2 focus:ring-accent/15 dark:focus:ring-accent/25 disabled:opacity-60";

const PAPER_CLASS =
  "w-full min-h-[280px] resize-y rounded-xl border border-border bg-[#FBF9F4] px-4 py-4 font-serif text-[15px] leading-relaxed text-foreground shadow-inner outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground/70 focus:border-accent/40 focus:ring-2 focus:ring-accent/10 dark:bg-[#1a1814] dark:placeholder:text-muted-foreground/50";

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

/**
 * Formulário leve: campos da imagem + papel em branco.
 * @param {{
 *   dados: Record<string, unknown>,
 *   canEdit: boolean,
 *   onFieldChange: (key: string, value: string | string[]) => void,
 *   intro?: string | null,
 *   idPrefix?: string,
 * }} props
 */
export default function IdentidadeMarcaCamposImagem({
  dados,
  canEdit,
  onFieldChange,
  intro,
  idPrefix = "",
}) {
  const [maisOpen, setMaisOpen] = useState(false);
  const papelLen = String(dados.papel_agente || "").length;

  return (
    <div className="space-y-5">
      {intro ? <p className="text-sm text-muted-foreground">{intro}</p> : null}

      <section className="rounded-xl border border-border bg-muted/10 p-4 sm:p-5">
        <h3 className="text-sm font-semibold text-foreground">Para a arte</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Só o essencial que o gerador de imagem usa: cores, como a arte parece e o que não fazer.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <ColorField
            id={`${idPrefix}cor_primaria`}
            label="Cor principal"
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

        <div className="mt-5">
          <label htmlFor={`${idPrefix}estilo_visual`} className="mb-1 block text-xs font-medium text-foreground">
            Como a arte deve parecer
          </label>
          <p className="mb-1.5 text-[11px] text-muted-foreground">Ex.: limpo, premium, produto no centro…</p>
          <textarea
            id={`${idPrefix}estilo_visual`}
            value={String(dados.estilo_visual || "")}
            disabled={!canEdit}
            onChange={(e) => onFieldChange("estilo_visual", e.target.value)}
            placeholder="Limpo, moderno, tipografia forte, foco no produto"
            className={`${INPUT_CLASS} min-h-[72px] resize-y`}
          />
          <IdentidadeMarcaPresetChips
            presets={PRESETS_ESTILO_VISUAL}
            disabled={!canEdit}
            onSelect={(v) => onFieldChange("estilo_visual", v)}
          />
        </div>

        <div className="mt-4">
          <label htmlFor={`${idPrefix}evitar`} className="mb-1 block text-xs font-medium text-foreground">
            Evitar
          </label>
          <p className="mb-1.5 text-[11px] text-muted-foreground">
            O que não pode aparecer (cara de IA genérica, clipart, etc.).
          </p>
          <textarea
            id={`${idPrefix}evitar`}
            value={String(dados.evitar || "")}
            disabled={!canEdit}
            onChange={(e) => onFieldChange("evitar", e.target.value)}
            placeholder={EVITAR_PADRAO_IMAGEM}
            className={`${INPUT_CLASS} min-h-[64px] resize-y`}
          />
          <IdentidadeMarcaPresetChips
            presets={PRESETS_EVITAR}
            disabled={!canEdit}
            onSelect={(v) => onFieldChange("evitar", v)}
          />
          {!String(dados.evitar || "").trim() && canEdit ? (
            <button
              type="button"
              className="mt-1 text-xs font-medium text-accent hover:underline"
              onClick={() => onFieldChange("evitar", EVITAR_PADRAO_IMAGEM)}
            >
              Usar texto padrão
            </button>
          ) : null}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-surface-elevated/40 p-4 sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Papel em branco</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Escreva do seu jeito — tom, regras, o que a marca é. Isso vira o arquivo que o agente lê.
            </p>
          </div>
          <span className="text-[11px] tabular-nums text-muted-foreground">{papelLen}/12000</span>
        </div>
        <textarea
          id={`${idPrefix}papel_agente`}
          value={String(dados.papel_agente || "")}
          disabled={!canEdit}
          onChange={(e) => onFieldChange("papel_agente", e.target.value.slice(0, 12000))}
          placeholder={`Exemplo:\n\nSomos a FYT. Tom direto, sem firula.\nNas artes: produto grande, cores da marca, sem layout genérico de IA.\nTextos curtos e confantes.\nNunca inventar sabor ou embalagem que não temos no acervo.`}
          className={`${PAPER_CLASS} mt-3`}
        />
      </section>

      <section className="rounded-xl border border-dashed border-border/80">
        <button
          type="button"
          onClick={() => setMaisOpen((v) => !v)}
          className="flex w-full items-center justify-between px-4 py-3 text-left text-sm text-muted-foreground hover:text-foreground"
        >
          <span>Mais detalhes (opcional)</span>
          <span aria-hidden>{maisOpen ? "▾" : "▸"}</span>
        </button>
        {maisOpen ? (
          <div className="space-y-4 border-t border-border px-4 pb-4 pt-3">
            <div>
              <label htmlFor={`${idPrefix}tom_voz`} className="mb-1 block text-xs font-medium">
                Tom / mood
              </label>
              <input
                id={`${idPrefix}tom_voz`}
                type="text"
                value={String(dados.tom_voz || "")}
                disabled={!canEdit}
                onChange={(e) => onFieldChange("tom_voz", e.target.value)}
                placeholder="Confiante, próximo, premium…"
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label htmlFor={`${idPrefix}exemplo_frase_marca`} className="mb-1 block text-xs font-medium">
                Frase de exemplo
              </label>
              <input
                id={`${idPrefix}exemplo_frase_marca`}
                type="text"
                value={String(dados.exemplo_frase_marca || "")}
                disabled={!canEdit}
                onChange={(e) => onFieldChange("exemplo_frase_marca", e.target.value)}
                placeholder="Estilo de headline — não é texto fixo"
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label htmlFor={`${idPrefix}assinatura_visual`} className="mb-1 block text-xs font-medium">
                Assinatura visual
              </label>
              <textarea
                id={`${idPrefix}assinatura_visual`}
                value={String(dados.assinatura_visual || "")}
                disabled={!canEdit}
                onChange={(e) => onFieldChange("assinatura_visual", e.target.value)}
                placeholder="O que se repete: tipografia, produto, contraste…"
                className={`${INPUT_CLASS} min-h-16 resize-y`}
              />
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
