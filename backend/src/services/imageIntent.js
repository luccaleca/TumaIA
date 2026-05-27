import { buildResumoVisual, resolveFraseNaImagem, resolvePedidoCliente } from "./imageHeadline.js";

function contextIdFromRow(row) {
  return String(row?.id_contexto_empresa ?? "").trim();
}

function contextSchemaTipo(row) {
  if (row?.schema_json && typeof row.schema_json === "object" && row.schema_json.tipo) {
    return String(row.schema_json.tipo).trim();
  }
  if (row?.dados_json && typeof row.dados_json === "object" && row.dados_json.tipo) {
    return String(row.dados_json.tipo).trim();
  }
  return "";
}

function normalizeMatchedContext(row, reason = "confirmado_no_fluxo") {
  if (!row || typeof row !== "object") return null;
  const id = contextIdFromRow(row);
  const nome = String(row?.nome ?? "").trim();
  if (!id || !nome) return null;
  return {
    id_contexto_empresa: id,
    nome,
    tipo_schema: contextSchemaTipo(row),
    reason,
  };
}

function findContextRowById(contextoRows, id) {
  const wanted = String(id || "").trim();
  if (!wanted) return null;
  return (Array.isArray(contextoRows) ? contextoRows : []).find(
    (row) => contextIdFromRow(row) === wanted,
  ) || null;
}

function uniqueContextRows(contextoRows, selectedRow = null) {
  const rows = Array.isArray(contextoRows) ? contextoRows : [];
  if (!selectedRow) return rows;
  const selectedId = contextIdFromRow(selectedRow);
  if (!selectedId) return rows;
  return [selectedRow, ...rows.filter((row) => contextIdFromRow(row) !== selectedId)];
}

function buildSelectionHint(proposal, pedido, fraseNaImagem, matchedContexto) {
  const parts = [];
  if (pedido) parts.push(`pedido: ${pedido}`);
  if (fraseNaImagem) parts.push(`frase: ${fraseNaImagem}`);
  if (matchedContexto?.nome) parts.push(`contexto: ${matchedContexto.nome}`);
  if (proposal?.hero_product?.nome_exibicao) {
    parts.push(`hero: ${String(proposal.hero_product.nome_exibicao).trim()}`);
  }
  if (proposal?.arte_brief?.tema) parts.push(`tema: ${String(proposal.arte_brief.tema).trim()}`);
  if (Array.isArray(proposal?.midias_referenced)) {
    for (const item of proposal.midias_referenced.slice(0, 3)) {
      const nome = String(item?.nome_exibicao ?? "").trim();
      if (nome) parts.push(`midia: ${nome}`);
    }
  }
  return parts.join(" | ").slice(0, 900);
}

function normalizeHeroProduct(proposal) {
  const proposalObj = proposal && typeof proposal === "object" ? proposal : {};
  const refs = Array.isArray(proposalObj.midias_referenced) ? proposalObj.midias_referenced : [];
  const refById = new Map(
    refs
      .filter((item) => item && typeof item === "object")
      .map((item) => [String(item.id_midia ?? "").trim(), item]),
  );
  const raw =
    proposalObj.hero_product && typeof proposalObj.hero_product === "object" ? proposalObj.hero_product : null;
  const rawId = raw && typeof raw.id_midia === "string" ? raw.id_midia.trim() : "";
  const rawName = raw && typeof raw.nome_exibicao === "string" ? raw.nome_exibicao.trim() : "";
  const rawReason = raw && typeof raw.reason === "string" ? raw.reason.trim() : "";
  if (rawId && refById.has(rawId)) {
    const row = refById.get(rawId);
    return {
      id_midia: rawId,
      nome_exibicao: String(row?.nome_exibicao ?? rawName ?? "Mídia").trim() || "Mídia",
      reason: rawReason || "confirmado_no_fluxo",
    };
  }
  if (refs.length) {
    const first = refs[0];
    return {
      id_midia: String(first.id_midia ?? "").trim() || null,
      nome_exibicao: String(first.nome_exibicao ?? rawName ?? "Mídia").trim() || "Mídia",
      reason: rawReason || "primeira_referencia",
    };
  }
  if (rawId || rawName) {
    return {
      id_midia: rawId || null,
      nome_exibicao: rawName || "Mídia",
      reason: rawReason || "confirmado_no_fluxo",
    };
  }
  return null;
}

/**
 * Fonte única de verdade para a intenção visual usada na prévia.
 *
 * @param {{
 *   history?: Array<{ role: string, content: string }>,
 *   postContextProposal?: Record<string, unknown> | null,
 *   contextoRows?: Array<Record<string, unknown>>,
 *   focusContextoId?: string | null,
 * }} opts
 */
export function buildConfirmedImageIntent(opts = {}) {
  const history = Array.isArray(opts.history) ? opts.history : [];
  const contextoRows = Array.isArray(opts.contextoRows) ? opts.contextoRows : [];
  const baseProposal =
    opts.postContextProposal && typeof opts.postContextProposal === "object"
      ? { ...opts.postContextProposal }
      : {};

  const focusedRow = findContextRowById(contextoRows, opts.focusContextoId);
  const proposalMatchedId =
    baseProposal?.matched_contexto && typeof baseProposal.matched_contexto === "object"
      ? String(baseProposal.matched_contexto.id_contexto_empresa ?? "").trim()
      : "";
  const proposalMatchedRow = focusedRow ? null : findContextRowById(contextoRows, proposalMatchedId);
  const matchedRow = focusedRow || proposalMatchedRow || null;

  const matchedContexto =
    normalizeMatchedContext(
      matchedRow,
      focusedRow ? "escolhido_no_painel" : proposalMatchedRow ? "confirmado_no_fluxo" : "sem_contexto",
    ) ||
    (baseProposal?.matched_contexto && typeof baseProposal.matched_contexto === "object"
      ? baseProposal.matched_contexto
      : null);

  const postContextProposal = {
    ...baseProposal,
    ...(matchedContexto ? { matched_contexto: matchedContexto } : {}),
  };
  const heroProduct = normalizeHeroProduct(postContextProposal);
  if (heroProduct) {
    postContextProposal.hero_product = heroProduct;
  }

  const prioritizedContextRows = uniqueContextRows(contextoRows, matchedRow);
  const pedido =
    resolvePedidoCliente(postContextProposal, history, 2000) ||
    String(postContextProposal.intent_summary ?? "").trim() ||
    "";
  const fraseNaImagem = resolveFraseNaImagem(postContextProposal, history, prioritizedContextRows) || "";
  const resumoVisual = buildResumoVisual(postContextProposal, history, pedido);
  const selectionHint = buildSelectionHint(postContextProposal, pedido, fraseNaImagem, matchedContexto);

  return {
    pedido,
    fraseNaImagem,
    resumoVisual,
    matchedContexto,
    heroProduct,
    matchedContextRow: matchedRow,
    contextoRows: prioritizedContextRows,
    selectionHint,
    postContextProposal,
  };
}
