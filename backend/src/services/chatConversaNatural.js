/**
 * Conversa fora do core (receitas, curiosidades, dicas) — responde o que foi perguntado,
 * depois ponte suave para o trabalho da empresa. Sem «não entendi» / «isso foge».
 */

import { isDateTimeQuestion } from "./chatOutOfScopeResponse.js";
import { isPerfilGeralQuestion } from "./chatPerfilGeralThemes.js";

/** Pergunta casual / conhecimento geral — não é pedido de acervo/arte/identidade. */
export const CONVERSA_NATURAL_RE =
  /\b(receita|cozinhar|cozinha|como\s+fazer|como\s+preparar|ingrediente|assar|fritar|refogar|ferver|modo\s+de\s+preparo)\b|\b(me\s+)?(?:ensina|explica)\s+(?:como|o\s+que)\b|\b(dica\s+de|passo\s+a\s+passo|tutorial)\b|\b(o\s+que\s+(?:é|e|significa)\s+(?!vc|você|voce|tuma|tuma\s*ia)\b)|\b(por\s+que\s+(?:o|a|os|as)\s+)\b|\b(piada|hist[oó]ria\s+curta|conta\s+uma)\b|\b(clima|previs[aã]o\s+do\s+tempo|vai\s+chover)\b|\b(futebol|jogo\s+do|campeonato)\b|\b(quem\s+(?:foi|é|e)\s+(?!vc|você|tuma))\b|\b(capital\s+de|quantos\s+habitantes)\b|\b(como\s+aprender|estudar\s+para)\b/i;

const NEGOCIO_RE =
  /\b(post|arte|instagram|banner|stories|carrossel|m[ií]dia|mídias|acervo|produto|cadastr|monta|gera|cria\s+(?:um\s+)?post|contexto|black\s+friday|whey|monster|creatina|powerade|lista.*produto|quais\s+produtos)\b/i;

/**
 * Pergunta curta fora do fluxo de post/acervo — ex.: «batata», «receita de arroz».
 * @param {string} question
 */
export function isShortCasualCuriosity(question) {
  const q = String(question || "").trim();
  if (!q || q.length > 48) return false;
  if (isDateTimeQuestion(q)) return false;
  if (isPerfilGeralQuestion(q)) return false;
  if (NEGOCIO_RE.test(q)) return false;
  if (/^\s*(oi|ol[aá]|valeu|obrigad|tchau)\s*[!.?]*\s*$/i.test(q)) return false;
  if (q.length <= 24) return true;
  return CONVERSA_NATURAL_RE.test(q);
}

/**
 * @param {string} question
 */
export function isConversaNaturalQuestion(question) {
  const q = String(question || "").trim();
  if (!q || q.length < 3) return false;
  if (isDateTimeQuestion(q)) return false;
  if (isPerfilGeralQuestion(q)) return false;
  if (NEGOCIO_RE.test(q)) return false;
  if (/^\s*(oi|ol[aá]|valeu|obrigad|tchau)\s*[!.?]*\s*$/i.test(q)) return false;
  if (isShortCasualCuriosity(q)) return true;
  if (q.length < 4) return false;
  return CONVERSA_NATURAL_RE.test(q);
}

/**
 * @param {string | null} nomeFantasia
 */
function ponte(emp, curto = true) {
  if (!emp) {
    return curto
      ? " Se quiser, depois te ajudo com posts e o cadastro da empresa no painel."
      : "";
  }
  return curto
    ? ` Se quiser, depois monto post da ${emp} com as fotos em Mídias.`
    : ` Quando quiser algo da ${emp} (produtos, post, empresa), é só pedir.`;
}

/**
 * @param {string} question
 * @param {string | null} nomeFantasia
 * @returns {string | null} null = usar LLM conversa_aberta
 */
export function tryChatConversaNaturalResponse(question, nomeFantasia = null) {
  const q = String(question || "").trim();
  if (!q || !isConversaNaturalQuestion(q)) return null;

  const emp = String(nomeFantasia || "").trim() || null;
  const ql = q.toLowerCase();

  if (/^\s*batatas?\s*[!.?]*\s*$/i.test(ql)) {
    return (
      "Batata é bem versátil: cozinhe em água com sal uns 15–20 min até furar com o garfo, " +
      "asse cubos com azeite no forno (~200 °C, 25–35 min) ou faça purê e fritas." +
      ponte(emp)
    );
  }

  if (/\b(batata|batatas)\b/.test(ql) && /\b(cozinhar|receita|fazer|preparar|assar|cozinha)\b/.test(ql)) {
    return (
      "Para batata simples: descasque, corte em cubos e cozinhe em água fervente com sal uns 15–20 min até furar com o garfo; " +
      "ou cubos com azeite e sal no forno (~200 °C) por 25–35 min, mexendo na metade." +
      ponte(emp)
    );
  }

  if (/\b(arroz)\b/.test(ql) && /\b(cozinhar|fazer|receita)\b/.test(ql)) {
    return (
      "Arroz soltinho: lave, refogue 1 xícara de arroz em um fio de óleo, acrescente 2 xícaras de água quente e sal, " +
      "tampe em fogo baixo ~15 min e descanse 5 min antes de soltar." +
      ponte(emp)
    );
  }

  if (/\b(ovo|ovos)\b/.test(ql) && /\b(cozinhar|fazer|receita|mexido|omelete)\b/.test(ql)) {
    return (
      "Ovos mexidos: quebre em frigideira antiaderente com um fio de manteiga ou óleo, mexa em fogo baixo até firmar cremoso. " +
      "Omelete: bata com sal, despeje, recheie e dobre quando firmar embaixo." +
      ponte(emp)
    );
  }

  if (/\breceita\b/.test(ql) || (/\bcomo\s+(?:fazer|preparar)\b/.test(ql) && !NEGOCIO_RE.test(ql))) {
    const item = extrairItem(q) || "isso";
    return (
      `Sobre ${item}: em geral você separa ingredientes, prepara o básico (lavar, cortar, temperar) e cozinha no método certo ` +
      `(água, forno ou frigideira) até o ponto indicado — se disser o prato exato, afino os passos.` +
      ponte(emp)
    );
  }

  if (/\b(clima|previs[aã]o|vai\s+chover|tempo\s+hoje)\b/.test(ql)) {
    return (
      "Não tenho previsão do tempo em tempo real aqui — vale o app do clima ou uma busca com sua cidade." +
      ponte(emp)
    );
  }

  if (/\b(piada|engra[cç]ado)\b/.test(ql)) {
    return (
      "Rápida: por que o livro de matemática ficou triste? Porque tinha muitos problemas." +
      ponte(emp)
    );
  }

  if (/\b(futebol|jogo\s+do|brasileir[aã]o)\b/.test(ql)) {
    return (
      "Não acompanho placar ao vivo daqui — para jogo de hoje, o site do clube ou ge.globo costumam ter o horário certinho." +
      ponte(emp)
    );
  }

  if (/\b(o\s+que\s+(?:é|e|significa))\b/.test(ql) && !/\b(tuma|vc|você)\b/.test(ql)) {
    const termo = q.replace(/.*\b(o\s+que\s+(?:é|e|significa)|significa)\s*/i, "").trim().slice(0, 40);
    return (
      `Sobre «${termo || "isso"}»: não tenho um artigo completo aqui, mas em uma frase costuma ser o conceito que o nome indica — ` +
      `se quiser definição longa, Wikipedia ou um buscador ajudam; se for sigla de produto da loja, me fala que eu olho no acervo.` +
      ponte(emp)
    );
  }

  if (/\b(por\s+que)\b/.test(ql)) {
    return (
      "Depende do contexto — em geral é causa e efeito: algo aconteceu antes ou uma regra do assunto explica. " +
      "Se você detalhar o «por quê» exato, respondo mais focado." +
      ponte(emp)
    );
  }

  if (/\b(como\s+aprender|estudar\s+para|dica\s+de\s+estudo)\b/.test(ql)) {
    return (
      "Costuma funcionar: objetivo claro, prática em blocos curtos, revisão no dia seguinte e um projeto pequeno pra fixar." +
      ponte(emp)
    );
  }

  return null;
}

/**
 * @param {string} q
 */
function extrairItem(q) {
  const m = q.match(/\b(?:fazer|preparar|cozinhar)\s+(?:um|uma|o|a)?\s*([^.?!,]{3,40})/i);
  return m?.[1]?.trim() || null;
}

/**
 * Instrução extra para o worker Python (conversa_aberta).
 * @param {string | null} nomeFantasia
 */
export function buildConversaNaturalPromptHint(nomeFantasia = null) {
  const emp = nomeFantasia ? ` da ${nomeFantasia}` : "";
  return (
    "[Conversa natural — OBRIGATÓRIO]\n" +
    "1) Responda PRIMEIRO o que o usuário perguntou (receita, curiosidade, dica) em 2–4 frases úteis.\n" +
    "2) PROIBIDO: «não entendi», «não captei», «isso foge do escopo», «dia útil» sem data real.\n" +
    "3) Não liste produtos/acervo salvo se pedirem.\n" +
    `4) No fim, no máximo UMA frase opcional oferecendo ajuda${emp} com Mídias/posts — sem empurrar se a pergunta for só curiosidade.\n` +
    "Exemplo: «como cozinhar batata» → explique cozimento/assar; não fale só de marketing.\n\n"
  );
}
