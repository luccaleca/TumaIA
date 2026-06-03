/**
 * Perguntas fora do core (marketing / acervo) — resposta honesta, sem alucinar.
 * Data/hora: relógio do servidor (America/Sao_Paulo), sem LLM.
 */

const TZ = "America/Sao_Paulo";

/** @type {RegExp} */
export const DATE_TIME_QUESTION_RE =
  /\b(que\s+dia\s+(?:é|e)\s+hoje|qual\s+(?:é|e)\s+a\s+data(?:\s+de\s+hoje)?|data\s+de\s+hoje|que\s+horas?\s+s[aã]o|hora\s+atual|qual\s+hor[aá]rio|dia\s+da\s+semana|m[eê]s\s+e\s+ano|qual\s+dia\s+estamos|hoje\s+é\s+que\s+dia|me\s+(?:d(?:iz|iga)|fala)\s+a\s+data|quero\s+(?:o\s+)?dia(?:\s+da\s+semana)?|data\s+completa|calend[aá]rio\s+de\s+hoje)\b/i;

/** Legado — preferir isConversaNaturalQuestion em chatConversaNatural.js */
export const GENERAL_OFF_TOPIC_RE =
  /\b(pol[ií]tica|not[ií]cia\s+do\s+dia)\b/i;

const WEEKDAYS_PT = [
  "domingo",
  "segunda-feira",
  "terça-feira",
  "quarta-feira",
  "quinta-feira",
  "sexta-feira",
  "sábado",
];

/**
 * @param {Date} [now]
 */
export function getBrasiliaDateParts(now = new Date()) {
  const fmt = new Intl.DateTimeFormat("pt-BR", {
    timeZone: TZ,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(now);
  /** @type {Record<string, string>} */
  const map = {};
  for (const p of parts) {
    if (p.type !== "literal") map[p.type] = p.value;
  }
  const weekdayRaw = (map.weekday || "").toLowerCase();
  const weekday = WEEKDAYS_PT.find((w) => weekdayRaw.includes(w.split("-")[0])) || weekdayRaw;
  return {
    weekday,
    day: map.day || "",
    month: map.month || "",
    year: map.year || "",
    time: `${map.hour || "00"}:${map.minute || "00"}`,
  };
}

/**
 * @param {Date} [now]
 */
export function formatBrasiliaDateAnswer(now = new Date()) {
  const p = getBrasiliaDateParts(now);
  return `Hoje é ${p.weekday}, ${p.day} de ${p.month} de ${p.year} (horário de Brasília, ${p.time}).`;
}

/**
 * @param {string} question
 */
export function isDateTimeQuestion(question) {
  return DATE_TIME_QUESTION_RE.test(String(question || "").trim());
}

/**
 * @param {string} question
 */
export function isGeneralOffTopicQuestion(question) {
  const q = String(question || "").trim();
  if (!q) return false;
  if (isDateTimeQuestion(q)) return true;
  return GENERAL_OFF_TOPIC_RE.test(q);
}

/**
 * @param {string | null} nomeFantasia
 */
function marca(nomeFantasia) {
  return String(nomeFantasia || "").trim() || null;
}

/**
 * @param {string} question
 * @param {string | null} [nomeFantasia]
 * @returns {string | null}
 */
export function tryChatOutOfScopeResponse(question, nomeFantasia = null) {
  const q = String(question || "").trim();
  if (!q) return null;

  if (isDateTimeQuestion(q)) {
    if (/\b(horas?|hor[aá]rio)\b/i.test(q) && !/\b(dia|data|semana|m[eê]s)\b/i.test(q)) {
      const p = getBrasiliaDateParts();
      return `Agora são ${p.time} em Brasília (${p.weekday}, ${p.day} de ${p.month} de ${p.year}).`;
    }
    return formatBrasiliaDateAnswer();
  }

  if (!GENERAL_OFF_TOPIC_RE.test(q)) return null;

  const emp = marca(nomeFantasia);
  return emp
    ? `Sobre política/notícias gerais não sou a melhor fonte aqui — no dia a dia ajudo a ${emp} com Mídias e posts. Quer algo nessa linha?`
    : "Sobre política/notícias gerais não sou a melhor fonte — no painel ajudo com Mídias e posts da empresa.";
}
