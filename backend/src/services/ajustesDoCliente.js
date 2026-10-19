/**
 * Ajustes que o cliente faz no resumo ANTES de gerar a imagem (texto, detalhes, cores).
 * Espelha `aplicarEdicaoNoSuplemento` do painel (frontend/app/painel/chat/chatImageConfirmUtils.js),
 * para o WhatsApp e o painel terem o mesmo comportamento. O resultado fica em
 * `proposta.ajustes_do_cliente`, que o prompt da imagem lê (imageIntent.js).
 */

export const FRASE_NA_ARTE_MAX = 56;

const PRECO = /R\$\s?\d+(?:[.,]\d+)*/i;
const PRECO_GLOBAL = /R\$\s?\d+(?:[.,]\d+)*/gi;
const HEX = /^#[0-9a-f]{6}$/i;
const semEspaco = (s) => String(s).replace(/\s+/g, "").toLowerCase();

function mesmoConjunto(a, b) {
  const x = a.map((c) => c.toUpperCase());
  const y = b.map((c) => c.toUpperCase());
  return x.length === y.length && x.every((c) => y.includes(c));
}

function trocarPreco(texto, de, para) {
  if (typeof texto !== "string" || !texto) return texto;
  return texto.replace(PRECO_GLOBAL, (achado) => {
    if (semEspaco(achado) !== semEspaco(de)) return achado;
    return /\s/.test(achado) ? para.replace(/R\$\s?/i, "R$ ") : para.replace(/R\$\s?/i, "R$");
  });
}

/**
 * Aplica um ajuste na proposta. Campo omitido (`undefined`) mantém o valor atual.
 * Trocar o valor em reais na frase troca o preço antigo em todos os campos da proposta.
 *
 * @param {Record<string, unknown>} proposta
 * @param {{ frase?: string, detalhes?: string, cores?: string[] }} edits
 */
export function aplicarEdicaoNaProposta(proposta, edits = {}) {
  const atual = proposta && typeof proposta === "object" ? proposta : {};
  const brief = atual.arte_brief && typeof atual.arte_brief === "object" ? atual.arte_brief : {};
  const antes =
    atual.ajustes_do_cliente && typeof atual.ajustes_do_cliente === "object" ? atual.ajustes_do_cliente : {};

  let frase = edits.frase === undefined ? "" : String(edits.frase).trim().replace(/\s+/g, " ");
  if (frase.length > FRASE_NA_ARTE_MAX) frase = `${frase.slice(0, FRASE_NA_ARTE_MAX - 1).trim()}…`;
  const fraseFinal = frase || String(atual.frase_na_imagem ?? "");

  const detalhes =
    edits.detalhes === undefined ? String(antes.detalhes ?? brief.observacoes ?? "") : String(edits.detalhes).trim().slice(0, 300);

  const validas = (lista) => (Array.isArray(lista) ? lista : []).filter((c) => HEX.test(String(c)));
  const coresDoBrief = validas(brief.cores);
  const coresOriginais = validas(antes.cores_originais).length ? validas(antes.cores_originais) : coresDoBrief;
  const coresNovas = validas(edits.cores);
  const cores = coresNovas.length ? coresNovas : validas(antes.cores).length ? validas(antes.cores) : coresDoBrief;
  const coresAlteradas = cores.length > 0 && coresOriginais.length > 0 && !mesmoConjunto(cores, coresOriginais);

  const precoAntigo = [atual.frase_na_imagem, brief.tema, atual.intent_summary]
    .map((t) => String(t ?? "").match(PRECO)?.[0])
    .find(Boolean);
  const precoNovo = frase.match(PRECO)?.[0];
  const precoOriginal = String(antes.preco_de || precoAntigo || "");
  const precoFinal = String(precoNovo || antes.preco_para || "");
  const trocouPreco = Boolean(precoOriginal && precoFinal && semEspaco(precoOriginal) !== semEspaco(precoFinal));
  const sincronizar = (t) =>
    precoAntigo && precoNovo && semEspaco(precoAntigo) !== semEspaco(precoNovo)
      ? trocarPreco(t, precoAntigo, precoNovo)
      : t;

  const nova = { ...atual };
  nova.ajustes_do_cliente = {
    frase: fraseFinal,
    detalhes,
    cores,
    cores_originais: coresOriginais,
    cores_alteradas: coresAlteradas,
    preco_de: trocouPreco ? precoOriginal : "",
    preco_para: trocouPreco ? precoFinal : "",
  };
  if (typeof nova.intent_summary === "string") nova.intent_summary = sincronizar(nova.intent_summary);
  if (typeof nova.resumo_visual === "string") nova.resumo_visual = sincronizar(nova.resumo_visual);
  if (frase) {
    nova.frase_na_imagem = frase;
    nova.facts_for_image = {
      ...(atual.facts_for_image && typeof atual.facts_for_image === "object" ? atual.facts_for_image : {}),
      frase_na_imagem: frase,
    };
  }
  nova.arte_brief = {
    ...brief,
    ...(frase ? { texto: frase } : {}),
    tema: sincronizar(typeof brief.tema === "string" ? brief.tema : ""),
    observacoes: sincronizar(detalhes),
    ...(cores.length ? { cores } : {}),
  };
  return nova;
}

const CORES_EM_PORTUGUES = new Map([
  ["preto", "#000000"],
  ["branco", "#FFFFFF"],
  ["vermelho", "#D32F2F"],
  ["vermelho escuro", "#8E1B1B"],
  ["azul", "#1E6FFF"],
  ["azul escuro", "#0A1F44"],
  ["azul marinho", "#0A1F44"],
  ["azul claro", "#9ECBFF"],
  ["verde", "#2E7D32"],
  ["verde escuro", "#1B5E20"],
  ["verde claro", "#A5D6A7"],
  ["amarelo", "#FFC107"],
  ["laranja", "#FF8C00"],
  ["roxo", "#7B1FA2"],
  ["rosa", "#E91E63"],
  ["marrom", "#6D4C41"],
  ["cinza", "#808080"],
  ["dourado", "#C9A227"],
  ["prata", "#C0C0C0"],
  ["bege", "#F3E6D0"],
  ["creme", "#F3E6D0"],
]);

function semAcento(s) {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/**
 * «azul e branco, #FF0000» → cores em #RRGGBB. O que não for entendido volta em `naoEntendidas`.
 * @param {string} texto
 * @returns {{ cores: string[], naoEntendidas: string[] }}
 */
export function interpretarCores(texto) {
  const cores = [];
  const naoEntendidas = [];
  const partes = semAcento(texto)
    .replace(/\s+e\s+/g, ",")
    .split(/[,;/+]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  for (const parte of partes) {
    const hex = /^#?([0-9a-f]{6})$/i.exec(parte);
    const valor = hex ? `#${hex[1].toUpperCase()}` : CORES_EM_PORTUGUES.get(parte.replace(/^(cor|tom)\s+/, ""));
    if (!valor) {
      naoEntendidas.push(parte);
    } else if (!cores.includes(valor) && cores.length < 5) {
      cores.push(valor);
    }
  }
  return { cores, naoEntendidas };
}

const CAMPO = /^\s*(texto|frase|detalhes?|cor(?:es)?)\s*[:\-–]\s*(.+?)\s*$/i;

/**
 * Lê ajustes escritos pelo cliente no WhatsApp, um campo por linha:
 *   texto: Sexta da calabresa, grande por R$ 59
 *   cores: azul e branco
 *   detalhes: fundo mais claro
 * Devolve `null` se a mensagem não tiver nenhum desses campos.
 *
 * @param {string} mensagem
 * @returns {{ frase?: string, detalhes?: string, cores?: string[], coresNaoEntendidas?: string[] } | null}
 */
export function interpretarAjustesDoWhatsapp(mensagem) {
  const linhas = String(mensagem ?? "").split(/\r?\n/);
  /** @type {{ frase?: string, detalhes?: string, cores?: string[], coresNaoEntendidas?: string[] }} */
  const out = {};
  let achou = false;
  for (const linha of linhas) {
    const m = CAMPO.exec(linha);
    if (!m) continue;
    achou = true;
    const campo = semAcento(m[1]);
    const valor = m[2];
    if (campo === "texto" || campo === "frase") out.frase = valor;
    else if (campo.startsWith("detalhe")) out.detalhes = valor;
    else {
      const { cores, naoEntendidas } = interpretarCores(valor);
      if (cores.length) out.cores = cores;
      if (naoEntendidas.length) out.coresNaoEntendidas = naoEntendidas;
    }
  }
  return achou ? out : null;
}
