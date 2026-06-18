"use client";

import Link from "next/link";
import {
  formatResumoVisualFromProposal,
  formatMontagemFromProposal,
  midiaItemsFromProposal,
} from "./chatImageConfirmUtils";

const ROW_LABEL_CLASS = "min-w-[72px] pt-0.5 text-xs font-medium text-muted-foreground";
const CHIP_CLASS =
  "inline-flex items-center rounded-md border border-border bg-background/80 px-2 py-0.5 text-xs font-medium text-foreground transition hover:border-accent/35 hover:text-accent";

/**
 * Resumo antes de gerar a imagem: confirmação + troca de contexto + links.
 */
export default function ChatImageConfirmBlock({
  supplement,
  contextosCampanha,
  selectedContextoId,
  onContextoChange,
  disabled,
  collecting = false,
  hasArteBrief = false,
}) {
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
  const contextLinks = links.filter((item) => item?.kind === "contexto");
  const itemLinks = midiaItemsFromProposal(proposal, links);
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

  return (
    <div className="mt-3 space-y-2.5 rounded-xl border border-border bg-surface-elevated/50 px-3 py-2.5 text-sm leading-relaxed">
      {resumoVisual ? (
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

      {contextLinks.length > 0 ? (
        <div className="flex flex-col gap-1 sm:flex-row sm:gap-3">
          <p className={ROW_LABEL_CLASS}>Modelo de post</p>
          <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
            {contextLinks.map((l) => (
              <Link key={`${l.kind}-${l.id}`} href={l.href} className={CHIP_CLASS}>
                {l.label}
              </Link>
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

      {!hasArteBrief && contextosCampanha.length > 0 ? (
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">Modelo de post</span>
          <select
            className="mt-1 w-full rounded-lg border border-border bg-background px-2.5 py-2 text-sm text-foreground"
            value={selectedContextoId || ""}
            disabled={disabled}
            onChange={(e) => onContextoChange(e.target.value)}
          >
            {contextosCampanha.map((c) => (
              <option key={c.id_contexto_empresa} value={c.id_contexto_empresa}>
                {c.nome || "Modelo"}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs text-muted-foreground">
            Layout visual usado nesta arte (Promoção, Lançamento, etc.).
          </span>
        </label>
      ) : null}
    </div>
  );
}
