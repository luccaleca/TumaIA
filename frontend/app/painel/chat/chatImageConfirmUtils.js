export const CHAT_PEDIDO_RESUMO_MSG =
  "Confira o resumo do seu pedido abaixo. Quando estiver certo, gere a prévia da imagem.";

export const CHAT_PEDIDO_AGUARDE_MSG = "Um momento, estamos preparando o resumo do seu pedido…";

export function formatFraseNaImagemFromProposal(proposal) {
  if (!proposal || typeof proposal !== "object") return null;
  const direct = proposal.frase_na_imagem;
  if (typeof direct === "string" && direct.trim()) return direct.trim();
  const facts = proposal.facts_for_image;
  if (facts && typeof facts === "object" && typeof facts.frase_na_imagem === "string") {
    const f = facts.frase_na_imagem.trim();
    if (f) return f;
  }
  return null;
}

/**
 * @param {Record<string, unknown>} msg
 * @param {string} ctxId
 * @param {Array<{ id_contexto_empresa: string, nome?: string, schema_json?: unknown }>} contextosCampanha
 */
const FRASE_MAX = 56;

/**
 * @param {Record<string, unknown>} msg
 * @param {string} frase
 */
export function patchMessageFrase(msg, frase) {
  if (!msg?.post_supplement) return msg;
  let s = String(frase ?? "").trim().replace(/\s+/g, " ");
  if (!s) return msg;
  if (s.length > FRASE_MAX) s = `${s.slice(0, FRASE_MAX - 1)}…`;
  const proposal = {
    ...(msg.post_supplement.post_context_proposal &&
    typeof msg.post_supplement.post_context_proposal === "object"
      ? msg.post_supplement.post_context_proposal
      : {}),
    frase_na_imagem: s,
    facts_for_image: {
      ...(msg.post_supplement.post_context_proposal?.facts_for_image &&
      typeof msg.post_supplement.post_context_proposal.facts_for_image === "object"
        ? msg.post_supplement.post_context_proposal.facts_for_image
        : {}),
      frase_na_imagem: s,
    },
  };
  return {
    ...msg,
    post_supplement: {
      ...msg.post_supplement,
      post_context_proposal: proposal,
    },
  };
}

export function patchMessageContextoSelection(msg, ctxId, contextosCampanha) {
  if (!msg?.post_supplement || !ctxId) return msg;
  const row = contextosCampanha.find((c) => String(c.id_contexto_empresa) === String(ctxId));
  if (!row) return msg;
  const nome = String(row.nome ?? "").trim() || "contexto";
  const tipo =
    row.schema_json && typeof row.schema_json === "object" && row.schema_json.tipo
      ? String(row.schema_json.tipo)
      : "";
  const proposal = {
    ...(msg.post_supplement.post_context_proposal &&
    typeof msg.post_supplement.post_context_proposal === "object"
      ? msg.post_supplement.post_context_proposal
      : {}),
    matched_contexto: {
      id_contexto_empresa: row.id_contexto_empresa,
      nome,
      tipo_schema: tipo,
      reason: "escolhido_no_painel",
    },
  };
  const links = (Array.isArray(msg.post_supplement.links) ? msg.post_supplement.links : []).filter(
    (l) => l && l.kind !== "contexto",
  );
  links.unshift({
    kind: "contexto",
    id: row.id_contexto_empresa,
    label: nome,
    href: `/painel/contextos?contexto=${encodeURIComponent(row.id_contexto_empresa)}`,
  });
  return {
    ...msg,
    selected_contexto_id: row.id_contexto_empresa,
    post_supplement: {
      ...msg.post_supplement,
      confirmation_message: `Resumo para a arte com o contexto «${nome}».`,
      post_context_proposal: proposal,
      links,
    },
  };
}
