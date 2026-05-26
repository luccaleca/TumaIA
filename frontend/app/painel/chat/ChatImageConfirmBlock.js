"use client";

import Link from "next/link";
import { formatFraseNaImagemFromProposal, formatMontagemFromProposal } from "./chatImageConfirmUtils";

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
  fraseNaImagem,
  onContextoChange,
  onFraseChange,
  disabled,
  collecting = false,
  hasArteBrief = false,
}) {
  const proposal = supplement?.post_context_proposal;
  const frase = fraseNaImagem ?? formatFraseNaImagemFromProposal(proposal);
  const montagem = formatMontagemFromProposal(proposal);
  const links = Array.isArray(supplement?.links) ? supplement.links : [];
  const confirmation =
    typeof supplement?.confirmation_message === "string" ? supplement.confirmation_message.trim() : "";
  const contextLinks = links.filter((item) => item?.kind === "contexto");
  const itemLinks = links.filter((item) => item?.kind === "midia");
  const showConfirmation =
    confirmation && !/^clique nos itens que vou usar na arte\.?$/i.test(confirmation);

  if (collecting) {
    if (!confirmation) return null;
    return (
      <div className="mt-3 rounded-xl border border-border bg-surface-elevated/60 px-3 py-2.5 text-sm leading-relaxed">
        <p className="whitespace-pre-wrap text-foreground">{confirmation}</p>
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-2.5 rounded-xl border border-border bg-surface-elevated/50 px-3 py-2.5 text-sm leading-relaxed">
      {montagem ? (
        <div className="flex flex-col gap-1 sm:flex-row sm:gap-3">
          <p className={ROW_LABEL_CLASS}>Montagem</p>
          <p className="min-w-0 flex-1 text-sm text-foreground">{montagem}</p>
        </div>
      ) : null}

      {contextLinks.length > 0 ? (
        <div className="flex flex-col gap-1 sm:flex-row sm:gap-3">
          <p className={ROW_LABEL_CLASS}>Contexto</p>
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
          <p className={ROW_LABEL_CLASS}>Itens</p>
          <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
            {itemLinks.map((l) => (
              <Link key={`${l.kind}-${l.id}`} href={l.href} className={CHIP_CLASS}>
                {l.label}
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      {showConfirmation ? <p className="text-xs text-muted-foreground">{confirmation}</p> : null}

      {!hasArteBrief && contextosCampanha.length > 0 ? (
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">Contexto desta arte</span>
          <select
            className="mt-1 w-full rounded-lg border border-border bg-background px-2.5 py-2 text-sm text-foreground"
            value={selectedContextoId || ""}
            disabled={disabled}
            onChange={(e) => onContextoChange(e.target.value)}
          >
            {contextosCampanha.map((c) => (
              <option key={c.id_contexto_empresa} value={c.id_contexto_empresa}>
                {c.nome || "Contexto"}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs text-muted-foreground">
            Campanha ou tipo de publicação usado nesta arte.
          </span>
        </label>
      ) : null}

      {!hasArteBrief ? (
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">Frase na imagem</span>
          <input
            type="text"
            maxLength={56}
            className="mt-1 w-full rounded-lg border border-border bg-background px-2.5 py-2 text-sm text-foreground"
            value={frase || ""}
            disabled={disabled}
            placeholder="Ex.: Até 40% OFF"
            onChange={(e) => onFraseChange(e.target.value)}
          />
          <span className="mt-1 block text-xs text-muted-foreground">
            Escreva o texto que deve aparecer na imagem.
          </span>
        </label>
      ) : (
        <p className="text-xs text-muted-foreground">
          Você pode ajustar tema, cores e textos no resumo da arte acima.
        </p>
      )}

    </div>
  );
}
