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

export function midiaItemsFromProposal(proposal, supplementLinks = []) {
  const fromLinks = Array.isArray(supplementLinks)
    ? supplementLinks.filter((l) => l?.kind === "midia" && l.id)
    : [];
  if (fromLinks.length) return fromLinks;

  const refs = Array.isArray(proposal?.midias_referenced) ? proposal.midias_referenced : [];
  return refs
    .filter((r) => r && typeof r === "object" && String(r.id_midia ?? "").trim())
    .map((r) => {
      const id = String(r.id_midia).trim();
      const nome = String(r.nome_exibicao ?? "").trim();
      const arquivo = String(r.nome_arquivo ?? "").trim();
      const label =
        nome && arquivo && arquivo !== nome ? `${nome} · ${arquivo}` : nome || arquivo || "Mídia";
      return {
        kind: "midia",
        id,
        label,
        href: `/painel/midias?midia=${encodeURIComponent(id)}`,
      };
    });
}

const HEX_COR = /^#[0-9a-f]{6}$/i;

/**
 * Descrição em linguagem simples de como a arte vai ficar, montada só com o que já está
 * na proposta (formato, produto, texto, cores, estilo). Serve para conferir antes de gerar
 * sem gastar crédito; não entra no prompt da imagem.
 *
 * @returns {{ rotulo: string, texto: string, cores?: string[] }[]}
 */
export function descreverComoFicaAArte(proposal, supplementLinks = []) {
  if (!proposal || typeof proposal !== "object") return [];
  const brief = proposal.arte_brief && typeof proposal.arte_brief === "object" ? proposal.arte_brief : {};
  const itens = [];

  const formato = brief.formato && typeof brief.formato === "object" ? brief.formato : null;
  if (formato?.ratio) {
    const forma =
      formato.orientation === "vertical" ? "vertical" : formato.orientation === "horizontal" ? "horizontal" : "quadrado";
    itens.push({ rotulo: "Formato", texto: `${formato.label || "Post"} ${forma} (${formato.ratio})` });
  }

  const nomes = midiaItemsFromProposal(proposal, supplementLinks)
    .map((m) => String(m.label || "").split(" · ")[0].trim())
    .filter(Boolean);
  if (nomes.length) {
    itens.push({
      rotulo: "Produto",
      texto: `A foto do acervo «${nomes.join("», «")}» fica em destaque, sem ser redesenhada.`,
    });
  }

  const frase = formatFraseNaImagemFromProposal(proposal);
  if (frase) itens.push({ rotulo: "Texto na arte", texto: `«${frase}»` });

  const fonteOferta = [proposal.intent_summary, brief.tema, brief.texto].filter((v) => typeof v === "string").join(" ");
  const preco = fonteOferta.match(/R\$\s?\d+(?:[.,]\d+)*/i)?.[0];
  if (preco) itens.push({ rotulo: "Preço", texto: `${preco.replace(/R\$\s?/i, "R$ ")} em destaque na arte` });

  const cores = (Array.isArray(brief.cores) ? brief.cores : []).filter((c) => HEX_COR.test(String(c)));
  if (cores.length) itens.push({ rotulo: "Cores", texto: cores.join(" · "), cores });

  const estilo = [brief.estilo, preco ? String(brief.observacoes ?? "").replace(/pre[cç]o em destaque\.?/i, "") : brief.observacoes]
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter(Boolean)
    .join(". ");
  if (estilo) itens.push({ rotulo: "Estilo", texto: estilo });

  const marca = proposal.identidade_resumo && typeof proposal.identidade_resumo === "object" ? proposal.identidade_resumo : {};
  const estiloMarca = typeof marca.estilo === "string" ? marca.estilo.trim() : "";
  const evitarMarca = typeof marca.evitar === "string" ? marca.evitar.trim() : "";
  if (estiloMarca) itens.push({ rotulo: "Clima da marca", texto: estiloMarca });
  if (evitarMarca) itens.push({ rotulo: "Evitar", texto: evitarMarca });

  return itens;
}

/** Mesmo limite que o backend usa para o texto que aparece na arte. */
export const FRASE_NA_ARTE_MAX = 56;

const PRECO_RE = /R\$\s?\d+(?:[.,]\d+)*/gi;
const semEspaco = (s) => String(s).replace(/\s+/g, "").toLowerCase();

function trocarPreco(texto, de, para) {
  if (typeof texto !== "string" || !texto) return texto;
  return texto.replace(PRECO_RE, (achado) => {
    if (semEspaco(achado) !== semEspaco(de)) return achado;
    return /\s/.test(achado) ? para.replace(/R\$\s?/i, "R$ ") : para.replace(/R\$\s?/i, "R$");
  });
}

/**
 * Aplica a edição do cliente no cartão de confirmação. O preço aparece em vários campos
 * da proposta (frase, tema, resumo), então um valor novo na frase troca o antigo em todos.
 *
 * @param {Record<string, unknown>} supplement
 * @param {{ frase?: string, detalhes?: string, cores?: string[] }} edits
 */
export function aplicarEdicaoNoSuplemento(supplement, edits = {}) {
  if (!supplement || typeof supplement !== "object") return supplement;
  const atual =
    supplement.post_context_proposal && typeof supplement.post_context_proposal === "object"
      ? supplement.post_context_proposal
      : {};
  const brief = atual.arte_brief && typeof atual.arte_brief === "object" ? atual.arte_brief : {};

  let frase = String(edits.frase ?? "").trim().replace(/\s+/g, " ");
  if (frase.length > FRASE_NA_ARTE_MAX) frase = `${frase.slice(0, FRASE_NA_ARTE_MAX - 1).trim()}…`;
  const detalhes = String(edits.detalhes ?? "").trim().slice(0, 300);
  const cores = (Array.isArray(edits.cores) ? edits.cores : []).filter((c) => HEX_COR.test(String(c)));

  const precoAntigo = [atual.frase_na_imagem, brief.tema, atual.intent_summary]
    .map((t) => String(t ?? "").match(/R\$\s?\d+(?:[.,]\d+)*/i)?.[0])
    .find(Boolean);
  const precoNovo = frase.match(/R\$\s?\d+(?:[.,]\d+)*/i)?.[0];
  const sincronizar = (t) =>
    precoAntigo && precoNovo && semEspaco(precoAntigo) !== semEspaco(precoNovo)
      ? trocarPreco(t, precoAntigo, precoNovo)
      : t;

  // O backend lê o pedido original do histórico; estes ajustes dizem o que mudou desde então.
  // O preço «de» é sempre o que está na mensagem original, mesmo após várias edições.
  const anteriores =
    atual.ajustes_do_cliente && typeof atual.ajustes_do_cliente === "object" ? atual.ajustes_do_cliente : {};
  const precoOriginal = String(anteriores.preco_de || precoAntigo || "");
  const precoFinal = String(precoNovo || anteriores.preco_para || "");
  const trocouPreco = Boolean(precoOriginal && precoFinal && semEspaco(precoOriginal) !== semEspaco(precoFinal));

  const proposta = { ...atual };
  proposta.ajustes_do_cliente = {
    frase: frase || String(atual.frase_na_imagem ?? ""),
    detalhes,
    cores,
    preco_de: trocouPreco ? precoOriginal : "",
    preco_para: trocouPreco ? precoFinal : "",
  };
  if (typeof proposta.intent_summary === "string") proposta.intent_summary = sincronizar(proposta.intent_summary);
  if (typeof proposta.resumo_visual === "string") proposta.resumo_visual = sincronizar(proposta.resumo_visual);

  if (frase) {
    proposta.frase_na_imagem = frase;
    proposta.facts_for_image = {
      ...(atual.facts_for_image && typeof atual.facts_for_image === "object" ? atual.facts_for_image : {}),
      frase_na_imagem: frase,
    };
  }
  proposta.arte_brief = {
    ...brief,
    ...(frase ? { texto: frase } : {}),
    tema: sincronizar(typeof brief.tema === "string" ? brief.tema : ""),
    observacoes: sincronizar(detalhes),
    ...(cores.length ? { cores } : {}),
  };
  return { ...supplement, post_context_proposal: proposta };
}

function normalizeLiteText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/** Evita mostrar o pedido literal do cliente como “resumo visual”. */
function looksLikeRawUserCopy(resumo, intent) {
  const r = normalizeLiteText(resumo);
  const i = normalizeLiteText(intent);
  if (!r || !i || i.length < 14) return false;
  if (r === i) return true;
  const chunk = i.slice(0, Math.min(56, i.length));
  return chunk.length >= 14 && r.includes(chunk);
}

export function formatResumoVisualFromProposal(proposal) {
  if (!proposal || typeof proposal !== "object") return null;
  const intent = typeof proposal.intent_summary === "string" ? proposal.intent_summary.trim() : "";
  const direct = proposal.resumo_visual;
  if (typeof direct === "string" && direct.trim()) {
    const trimmed = direct.trim();
    if (!looksLikeRawUserCopy(trimmed, intent)) return trimmed;
  }
  const montagem = formatMontagemFromProposal(proposal);
  if (montagem && !looksLikeRawUserCopy(montagem, intent)) return montagem;
  return null;
}

export function formatMontagemFromProposal(proposal) {
  if (!proposal || typeof proposal !== "object") return null;
  const intent = typeof proposal.intent_summary === "string" ? proposal.intent_summary.trim() : "";
  const direct = proposal.montagem_resumo;
  if (typeof direct === "string" && direct.trim()) {
    const montagem = compactMontagemLabel(direct) || direct.trim();
    if (!looksLikeRawUserCopy(montagem, intent)) return montagem;
  }
  const arteBrief = proposal.arte_brief;
  if (arteBrief && typeof arteBrief === "object" && typeof arteBrief.tema === "string" && arteBrief.tema.trim()) {
    const tema = compactMontagemLabel(arteBrief.tema) || arteBrief.tema.trim();
    if (!looksLikeRawUserCopy(tema, intent)) return tema;
  }
  return null;
}

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
  const row = contextosCampanha.find(
    (c) =>
      String(c.id_contexto_empresa) === String(ctxId) ||
      String(c.id_empresa_modelo_post || "") === String(ctxId),
  );
  if (!row) return msg;
  const nome = String(row.nome ?? "").trim() || "modelo";
  const tipo =
    row.schema_json && typeof row.schema_json === "object" && row.schema_json.tipo
      ? String(row.schema_json.tipo)
      : "";
  const rowId = row.id_contexto_empresa ?? row.id_empresa_modelo_post;
  const proposal = {
    ...(msg.post_supplement.post_context_proposal &&
    typeof msg.post_supplement.post_context_proposal === "object"
      ? msg.post_supplement.post_context_proposal
      : {}),
    matched_contexto: {
      id_contexto_empresa: rowId,
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
    id: rowId,
    label: nome,
    href: `/painel/empresa`,
  });
  return {
    ...msg,
    selected_contexto_id: rowId,
    post_supplement: {
      ...msg.post_supplement,
      confirmation_message: "Clique nos itens que vou usar na arte.",
      post_context_proposal: proposal,
      links,
    },
  };
}
