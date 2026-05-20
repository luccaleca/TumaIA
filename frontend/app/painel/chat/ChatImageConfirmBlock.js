"use client";

import Link from "next/link";
import { formatFraseNaImagemFromProposal } from "./chatImageConfirmUtils";

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
}) {
  const proposal = supplement?.post_context_proposal;
  const frase = fraseNaImagem ?? formatFraseNaImagemFromProposal(proposal);
  const links = Array.isArray(supplement?.links) ? supplement.links : [];
  const confirmation =
    typeof supplement?.confirmation_message === "string" ? supplement.confirmation_message.trim() : "";

  return (
    <div className="mt-3 space-y-3 rounded-xl border border-accent/35 bg-accent-muted/20 px-3 py-2.5 text-sm leading-relaxed">
      {confirmation ? (
        <p className="whitespace-pre-wrap font-medium text-foreground">{confirmation}</p>
      ) : null}

      {contextosCampanha.length > 0 ? (
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

      {links.length > 0 ? (
        <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
          {links.map((l) => (
            <li key={`${l.kind}-${l.id}`}>
              <Link
                href={l.href}
                className="font-semibold text-accent underline decoration-accent/45 underline-offset-2 hover:decoration-accent"
              >
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
