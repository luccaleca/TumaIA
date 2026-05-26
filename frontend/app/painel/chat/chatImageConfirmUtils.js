/** Texto salvo no histórico (API exige conteúdo não vazio); o bloco visual usa post_supplement. */
export const CHAT_PEDIDO_RESUMO_MSG = "Resumo do pedido para a arte:";

export const CHAT_PEDIDO_AGUARDE_MSG = "Preparando resumo…";

export const CHAT_PEDIDO_COLETANDO_INTRO = "Falta só completar o pedido:";

const MONTAGEM_STOP = new Set([
  "de",
  "da",
  "do",
  "das",
  "dos",
  "para",
  "com",
  "uma",
  "um",
  "post",
  "arte",
  "foto",
  "imagem",
  "pedido",
  "foco",
  "principal",
  "tema",
  "resumo",
]);

function compactMontagemLabel(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const normalized = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const words = [...new Set(normalized.match(/[a-z0-9]+/g) || [])]
    .filter((word) => word.length >= 3 && !MONTAGEM_STOP.has(word))
    .slice(0, 3);
  if (!words.length) return raw;
  return words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}

export function formatFraseNaImagemFromProposal(proposal) {
  if (!proposal || typeof proposal !== "object") return null;
  const hasDirect = Object.prototype.hasOwnProperty.call(proposal, "frase_na_imagem");
  const direct = proposal.frase_na_imagem;
  if (hasDirect) return typeof direct === "string" ? direct.trim() : null;
  const facts = proposal.facts_for_image;
  if (facts && typeof facts === "object" && typeof facts.frase_na_imagem === "string") {
    const f = facts.frase_na_imagem.trim();
    if (f) return f;
  }
  const arteBrief = proposal.arte_brief;
  if (arteBrief && typeof arteBrief === "object") {
    const texto = typeof arteBrief.texto === "string" ? arteBrief.texto.trim() : "";
    if (texto) return texto;
    const titulo = typeof arteBrief.titulo === "string" ? arteBrief.titulo.trim() : "";
    if (titulo) return titulo;
  }
  return null;
}

export function formatMontagemFromProposal(proposal) {
  if (!proposal || typeof proposal !== "object") return null;
  const direct = proposal.montagem_resumo;
  if (typeof direct === "string" && direct.trim()) return compactMontagemLabel(direct) || direct.trim();
  const arteBrief = proposal.arte_brief;
  if (arteBrief && typeof arteBrief === "object" && typeof arteBrief.tema === "string" && arteBrief.tema.trim()) {
    return compactMontagemLabel(arteBrief.tema) || arteBrief.tema.trim();
  }
  const summary = proposal.intent_summary;
  if (typeof summary === "string" && summary.trim()) return compactMontagemLabel(summary) || summary.trim();
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
  if (s.length > FRASE_MAX) s = `${s.slice(0, FRASE_MAX - 1)}…`;
  const currentProposal =
    msg.post_supplement.post_context_proposal &&
    typeof msg.post_supplement.post_context_proposal === "object"
      ? msg.post_supplement.post_context_proposal
      : {};
  const nextFacts = {
    ...(currentProposal.facts_for_image && typeof currentProposal.facts_for_image === "object"
      ? currentProposal.facts_for_image
      : {}),
    frase_na_imagem: s,
  };
  const nextArteBrief =
    currentProposal.arte_brief && typeof currentProposal.arte_brief === "object"
      ? {
          ...currentProposal.arte_brief,
          texto: s,
        }
      : currentProposal.arte_brief;
  const proposal = {
    ...currentProposal,
    frase_na_imagem: s,
    facts_for_image: nextFacts,
    ...(nextArteBrief && typeof nextArteBrief === "object" ? { arte_brief: nextArteBrief } : {}),
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
      confirmation_message: "Clique nos itens que vou usar na arte.",
      post_context_proposal: proposal,
      links,
    },
  };
}
