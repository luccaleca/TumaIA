"use client";

import Link from "next/link";
import { useState } from "react";
import ArteBriefPalette from "./ArteBriefPalette";
import {
  FRASE_NA_ARTE_MAX,
  descreverComoFicaAArte,
  formatFraseNaImagemFromProposal,
  formatResumoVisualFromProposal,
  formatMontagemFromProposal,
  midiaItemsFromProposal,
} from "./chatImageConfirmUtils";

const ROW_LABEL_CLASS = "min-w-[72px] pt-0.5 text-xs font-medium text-muted-foreground";
const CHIP_CLASS =
  "inline-flex items-center rounded-md border border-border bg-background/80 px-2 py-0.5 text-xs font-medium text-foreground transition hover:border-accent/35 hover:text-accent";

/**
 * Resumo antes de gerar a imagem: confirmação + links de mídia.
 */
export default function ChatImageConfirmBlock({
  supplement,
  disabled,
  collecting = false,
  hasArteBrief = false,
  canEdit = false,
  brandColors = [],
  onSaveEdit,
}) {
  const [editando, setEditando] = useState(false);
  const [form, setForm] = useState({ frase: "", detalhes: "", cores: [] });
  const proposal = supplement?.post_context_proposal;
  const resumoVisual = formatResumoVisualFromProposal(proposal);
  const montagem = formatMontagemFromProposal(proposal);
  const productMissing = proposal?.product_media_status === "missing";
  const productsRequested = Array.isArray(proposal?.products_requested)
    ? proposal.products_requested.filter(Boolean)
    : [];
  const links = Array.isArray(supplement?.links) ? supplement.links : [];
  const confirmation =
    typeof supplement?.confirmation_message === "string" ? supplement.confirmation_message.trim() : "";
  const itemLinks = midiaItemsFromProposal(proposal, links);
  const comoFica = descreverComoFicaAArte(proposal, links);
  const showConfirmation =
    confirmation && !/^clique nos itens que vou usar na arte\.?$/i.test(confirmation);

  if (collecting) {
    return (
      <div className="mt-3 space-y-2.5 rounded-xl border border-border bg-surface-elevated/60 px-3 py-2.5 text-sm leading-relaxed">
        {productMissing ? (
          <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-2.5 py-2 text-sm text-foreground">
            {confirmation || "Produto não encontrado em Mídias."}{" "}
            <Link href="/painel/midias" className="font-medium text-accent underline-offset-2 hover:underline">
              Abrir Mídias
            </Link>
          </p>
        ) : (
          <p className="whitespace-pre-wrap text-foreground">{confirmation}</p>
        )}
        {productsRequested.length > 0 && !productMissing ? (
          <p className="text-xs text-muted-foreground">
            Produto(s) pedido(s): {productsRequested.map((p) => `«${p}»`).join(", ")}
          </p>
        ) : null}
      </div>
    );
  }

  function abrirEdicao() {
    const brief = proposal?.arte_brief && typeof proposal.arte_brief === "object" ? proposal.arte_brief : {};
    setForm({
      frase: formatFraseNaImagemFromProposal(proposal) || "",
      detalhes: typeof brief.observacoes === "string" ? brief.observacoes : "",
      cores: Array.isArray(brief.cores) ? brief.cores : [],
    });
    setEditando(true);
  }

  function salvarEdicao() {
    onSaveEdit?.(form);
    setEditando(false);
  }

  const podeEditar = canEdit && typeof onSaveEdit === "function";
  const CAMPO_CLASS =
    "mt-1 w-full rounded-lg border border-border bg-background px-2.5 py-2 text-sm text-foreground outline-none focus:border-accent/55 focus:ring-2 focus:ring-accent/15";

  if (editando) {
    return (
      <div className="mt-3 space-y-3 rounded-xl border border-accent/35 bg-surface-elevated/50 px-3 py-3 text-sm leading-relaxed">
        <p className="font-semibold text-foreground">Editar antes de gerar</p>
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">
            Texto na arte ({form.frase.length}/{FRASE_NA_ARTE_MAX})
          </span>
          <input
            type="text"
            maxLength={FRASE_NA_ARTE_MAX}
            className={CAMPO_CLASS}
            value={form.frase}
            onChange={(e) => setForm((f) => ({ ...f, frase: e.target.value }))}
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">Detalhes extras (opcional)</span>
          <textarea
            rows={2}
            maxLength={300}
            className={CAMPO_CLASS}
            value={form.detalhes}
            placeholder="Ex.: fundo mais claro, logo maior, mais espaço em volta da pizza"
            onChange={(e) => setForm((f) => ({ ...f, detalhes: e.target.value }))}
          />
        </label>
        <ArteBriefPalette
          cores={form.cores}
          brandColors={brandColors}
          canEdit
          onChange={(cores) => setForm((f) => ({ ...f, cores }))}
        />
        <p className="text-xs text-muted-foreground">
          Salvar não gasta crédito. O botão Gerar imagem usa o que estiver aqui.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground shadow-sm hover:opacity-90"
            onClick={salvarEdicao}
          >
            Salvar
          </button>
          <button
            type="button"
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
            onClick={() => setEditando(false)}
          >
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-2.5 rounded-xl border border-border bg-surface-elevated/50 px-3 py-2.5 text-sm leading-relaxed">
      {podeEditar ? (
        <div className="flex justify-end">
          <button
            type="button"
            disabled={disabled}
            onClick={abrirEdicao}
            className="rounded-lg border border-border bg-background px-3 py-1 text-xs font-semibold text-foreground shadow-sm hover:bg-muted disabled:opacity-50"
          >
            Editar
          </button>
        </div>
      ) : null}
      {comoFica.length >= 2 ? (
        <div className="flex flex-col gap-1 sm:flex-row sm:gap-3">
          <p className={ROW_LABEL_CLASS}>Como vai ficar</p>
          <ul className="min-w-0 flex-1 space-y-1 text-sm text-foreground">
            {comoFica.map((item) => (
              <li key={item.rotulo}>
                <span className="font-medium">{item.rotulo}: </span>
                {item.cores ? (
                  <span className="inline-flex items-center gap-1.5 align-middle">
                    {item.cores.map((cor) => (
                      <span
                        key={cor}
                        title={cor}
                        className="inline-block h-4 w-4 rounded-full border border-border"
                        style={{ backgroundColor: cor }}
                      />
                    ))}
                  </span>
                ) : (
                  item.texto
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : resumoVisual ? (
        <div className="flex flex-col gap-1 sm:flex-row sm:gap-3">
          <p className={ROW_LABEL_CLASS}>Resumo visual</p>
          <p className="min-w-0 flex-1 whitespace-pre-wrap text-sm text-foreground">{resumoVisual}</p>
        </div>
      ) : montagem ? (
        <div className="flex flex-col gap-1 sm:flex-row sm:gap-3">
          <p className={ROW_LABEL_CLASS}>Montagem</p>
          <p className="min-w-0 flex-1 text-sm text-foreground">{montagem}</p>
        </div>
      ) : null}

      {Array.isArray(proposal?.pedido_campanha) && proposal.pedido_campanha.length > 0 ? (
        <div className="flex flex-col gap-1 sm:flex-row sm:gap-3">
          <p className={ROW_LABEL_CLASS}>Pedido</p>
          <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
            {proposal.pedido_campanha.map((label) => (
              <span
                key={label}
                className="inline-flex items-center rounded-md border border-accent/30 bg-accent/10 px-2 py-0.5 text-xs font-medium text-foreground"
              >
                {label}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {itemLinks.length > 0 ? (
        <div className="flex flex-col gap-1 sm:flex-row sm:gap-3">
          <p className={ROW_LABEL_CLASS}>
            PNG do acervo{itemLinks.length > 1 ? ` (${itemLinks.length})` : ""}
          </p>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            {itemLinks.map((l) => (
              <Link
                key={`${l.kind}-${l.id}`}
                href={l.href}
                className={`${CHIP_CLASS} w-fit max-w-full truncate`}
              >
                {l.label}
              </Link>
            ))}
          </div>
        </div>
      ) : productMissing ? null : (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          Nenhum PNG vinculado —{" "}
          <Link href="/painel/midias" className="font-medium underline-offset-2 hover:underline">
            cadastre em Mídias
          </Link>
          .
        </p>
      )}

      {showConfirmation ? <p className="text-xs text-muted-foreground">{confirmation}</p> : null}
    </div>
  );
}
