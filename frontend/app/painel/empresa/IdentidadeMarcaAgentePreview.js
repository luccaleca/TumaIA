"use client";

import { buildPreviewLinhasImagem, calcTreinoImagemStatus } from "../../../lib/identidadeMarcaTreino";
import { normalizeHexColor } from "../../../lib/identidadeMarcaUi";

/**
 * @param {{
 *   dados: Record<string, unknown>,
 *   compact?: boolean,
 *   showAdvanced?: boolean,
 *   agenteMarkdown?: string,
 *   onToggleAdvanced?: () => void,
 * }} props
 */
export default function IdentidadeMarcaAgentePreview({
  dados,
  compact = false,
  showAdvanced = false,
  agenteMarkdown = "",
  onToggleAdvanced,
}) {
  const linhas = buildPreviewLinhasImagem(dados);
  const status = calcTreinoImagemStatus(dados);
  const cores = [
    dados?.cor_primaria,
    dados?.cor_secundaria,
    ...(Array.isArray(dados?.cores_adicionais) ? dados.cores_adicionais : []),
  ]
    .map((c) => normalizeHexColor(c))
    .filter(Boolean)
    .filter((hex, i, arr) => arr.indexOf(hex) === i);

  const criticas = linhas.filter((l) =>
    ["cores", "estilo", "assinatura", "evitar", "logo"].includes(l.id),
  );

  return (
    <div className="rounded-xl border border-accent/25 bg-accent-muted/15 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-accent">O que a IA usa na arte</p>
          <p className="mt-1 text-sm text-foreground">
            {status.pronto_para_imagem
              ? "Treino mínimo pronto — estes blocos entram no prompt de imagem."
              : "Complete os campos em destaque para a IA parar de improvisar visual genérico."}
          </p>
        </div>
        <div className="text-right">
          <p className="text-lg font-semibold tabular-nums text-foreground">
            {status.ok}/{status.total}
          </p>
          <p className="text-[11px] text-muted-foreground">campos críticos</p>
        </div>
      </div>

      {cores.length ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Paleta</span>
          {cores.map((hex) => (
            <span
              key={hex}
              title={hex}
              className="h-7 w-7 rounded-full ring-1 ring-black/10 dark:ring-white/15"
              style={{ backgroundColor: hex }}
            />
          ))}
        </div>
      ) : null}

      <ul className={`mt-4 space-y-2 ${compact ? "max-h-40 overflow-y-auto pr-1" : ""}`}>
        {(compact ? criticas : linhas).map((item) => (
          <li
            key={item.id}
            className={`rounded-lg border px-3 py-2 text-sm ${
              item.ok
                ? "border-border/80 bg-background/70"
                : "border-amber-500/35 bg-amber-500/5 dark:bg-amber-950/20"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-muted-foreground">{item.label}</span>
              {!item.ok ? (
                <span className="shrink-0 rounded-full bg-amber-500/15 px-1.5 py-px text-[10px] font-medium text-amber-800 dark:text-amber-200">
                  falta
                </span>
              ) : null}
            </div>
            <p className="mt-0.5 leading-snug text-foreground">{item.value}</p>
          </li>
        ))}
      </ul>

      {onToggleAdvanced && agenteMarkdown ? (
        <button
          type="button"
          className="mt-3 text-xs font-medium text-accent hover:underline"
          onClick={onToggleAdvanced}
        >
          {showAdvanced ? "Ocultar regras completas do agente" : "Ver regras completas (markdown)"}
        </button>
      ) : null}

      {showAdvanced && agenteMarkdown ? (
        <pre className="mt-2 max-h-52 overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-muted/30 p-3 text-[11px] leading-relaxed text-muted-foreground">
          {agenteMarkdown}
        </pre>
      ) : null}
    </div>
  );
}
