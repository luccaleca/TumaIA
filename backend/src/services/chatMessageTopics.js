/**
 * Tópicos detectados na mensagem — base do treino dinâmico (várias perguntas na mesma frase).
 */

import { classifyChatAcervoIntent } from "./chatIntent.js";

const TOPIC_ORDER = [
  "SAUDACAO",
  "IDENTIDADE_QUEM",
  "IDENTIDADE_NOME",
  "IDENTIDADE_FUNCAO",
  "COMO_FUNCIONA",
  "CRIADOR",
  "SIGNIFICADO_NOME",
  "EMPRESA",
  "CONTEXTOS",
  "ACERVO_LISTA",
  "ACERVO_INFO",
  "AGRADECIMENTO",
];

/**
 * @param {string} q
 */
function norm(q) {
  return String(q || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * @param {string} question
 */
export function extractChatTopics(question) {
  const raw = String(question || "").trim();
  const q = norm(raw);
  const topics = new Set();

  if (/^\s*(oi+|ol[aá]|e\s*a[ií]|fala(?:\s+a[ií])?|opa+|bom\s+dia|boa\s+tarde|boa\s+noite|tudo\s+bem)\s*[!.?]*\s*$/i.test(raw)) {
    topics.add("SAUDACAO");
  }

  if (/\b(quem\s+(?:é|e)\s+(?:você|voce|vc|tu)|quem\s+(?:é|e)\s+vc)\b/i.test(q)) {
    topics.add("IDENTIDADE_QUEM");
  }

  if (/\b(qual\s+seu\s+nome|seu\s+nome|como\s+(?:você|voce|vc)\s+se\s+chama)\b/i.test(q)) {
    topics.add("IDENTIDADE_NOME");
  }

  if (
    /\b(?:para|pra|pro)\s+(?:que|q|oq)\s+(?:o\s+)?(?:vc|voce)\s+serve\b|\b(?:para|pra|pro)\s+(?:que|q|oq)\s+serve\b|\bserve\s+(?:pra|para)\s+(?:que|q|oq)\b/i.test(
      q,
    ) ||
    /\b(?:o\s+)?que\s+(?:vc|voce)\s+faz\b|\bpara\s+que\s+serve\b/i.test(q)
  ) {
    topics.add("IDENTIDADE_FUNCAO");
  }

  if (
    /\b(como\s+(?:você|voce|vc)\s+funciona|como\s+funciona\s+(?:o\s+)?(?:chat|tuma|painel|isso)|como\s+funciona)\b/i.test(
      q,
    )
  ) {
    topics.add("COMO_FUNCIONA");
  }

  if (
    /\b(por\s+quem\s+(?:voce|você|vc|te)\s+(?:foi\s+)?criad|quem\s+te\s+criou|quem\s+foi\s+(?:que\s+)?(?:te\s+)?criou|criador)\b/i.test(
      q,
    )
  ) {
    topics.add("CRIADOR");
  }

  if (/\b(significa\s+tuma|significado\s+do\s+nome|origem\s+do\s+nome)\b/i.test(q)) {
    topics.add("SIGNIFICADO_NOME");
  }

  if (
    /\b(qual\s+(?:é|e)\s+(?:a\s+)?empresa|sobre\s+a\s+empresa|nossa\s+empresa|segmento|instagram\s+da\s+empresa)\b/i.test(
      q,
    ) ||
    /\b(o\s+que\s+(?:é|e)\s+(?:a\s+)?fyt|fala\s+da\s+empresa)\b/i.test(q)
  ) {
    topics.add("EMPRESA");
  }

  if (/\b(contextos?|campanhas?\s+cadastrad|orientac(?:ao|ões)\s+de\s+marca|tom\s+de\s+voz)\b/i.test(q)) {
    topics.add("CONTEXTOS");
  }

  const acervo = classifyChatAcervoIntent(raw);
  if (acervo.kind === "LISTAR_PRODUTOS") topics.add("ACERVO_LISTA");
  if (acervo.kind === "INFO_PRODUTO") topics.add("ACERVO_INFO");

  if (/^\s*(obrigad|valeu|show|perfeito|fechou|tchau|ate\s+mais)\b/i.test(q)) {
    topics.add("AGRADECIMENTO");
  }

  return TOPIC_ORDER.filter((t) => topics.has(t));
}

/**
 * @param {string[]} topics
 */
export function isCompositeChatTopics(topics) {
  const list = Array.isArray(topics) ? topics : [];
  const substantive = list.filter((t) => t !== "SAUDACAO" && t !== "AGRADECIMENTO");
  return substantive.length >= 2 || (list.includes("SAUDACAO") && substantive.length >= 1);
}
