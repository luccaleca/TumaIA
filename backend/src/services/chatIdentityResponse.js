/**
 * Respostas rápidas: saudação + temas de perfil geral (várias famílias).
 */

import { classifyPerfilGeralTheme, tryPerfilGeralDirectResponse } from "./chatPerfilGeralThemes.js";

const CAPACIDADE_EXTRA_RE =
  /\b((?:você|voce|vc)\s+consegue(?:\s+me)?\s+ajudar|consegue\s+ajudar|(?:você|voce|vc)\s+pode\s+ajudar|se\s+eu\s+pedir\s+(?:uma\s+)?(?:post|postagem|arte)|d[aá]\s+pra\s+fazer\s+arte|como\s+fa[cç]o\s+pra\s+pedir\s+(?:um\s+)?post)\b/i;

const SAUDACAO_RE =
  /^\s*(oi+|ol[aá]|e\s*a[ií]|fala(?:\s+a[ií])?|opa+|bom\s+dia|boa\s+tarde|boa\s+noite|tudo\s+bem)(?:\s+tudo\s+bem)?\s*[!.?]*\s*$/i;

const AGRADECIMENTO_RE =
  /^\s*(obrigad[oa](\s+mesmo)?|valeu+|show+|perfeito+|fechou+|blz+|beleza+|tchau+|até\s+mais|falou+)\s*[!.?]*\s*$/i;

function marca(nomeFantasia) {
  const n = String(nomeFantasia || "").trim();
  return n || null;
}

const EMPRESA_ATIVA_RE =
  /\b(em\s+qual\s+empresa|qual\s+empresa\s+(?:estou|to|ativa|selecionada|usando|no\s+painel)|empresa\s+ativa|no\s+workspace)\b/i;

/**
 * @param {string} question
 * @param {string | null} nomeFantasia
 * @returns {string | null}
 */
export function tryChatIdentityResponse(question, nomeFantasia = null) {
  const q = String(question || "").trim();
  if (!q) return null;
  const emp = marca(nomeFantasia);

  if (EMPRESA_ATIVA_RE.test(q)) {
    return emp
      ? `Você está no workspace da ${emp} — é a empresa ativa na sua conta agora.`
      : "Ainda não identifiquei a empresa ativa. Abra o painel TumaIA e escolha «Usar no painel» na empresa desejada.";
  }

  if (AGRADECIMENTO_RE.test(q) || classifyPerfilGeralTheme(q) === "AGRADECIMENTO") {
    return emp
      ? `Perfeito! Quando a ${emp} precisar de algo, é só chamar.`
      : "Perfeito! Quando quiser, pode mandar a próxima.";
  }

  if (SAUDACAO_RE.test(q) || classifyPerfilGeralTheme(q) === "SAUDACAO") {
    if (/\bbom\s+dia\b/i.test(q)) {
      return emp
        ? `Bom dia! Sou o Tuma IA, da ${emp}. O que você precisa hoje?`
        : "Bom dia! Sou o Tuma IA. O que você precisa hoje?";
    }
    if (/\bboa\s+tarde\b/i.test(q)) {
      return emp
        ? `Boa tarde! Sou o Tuma IA, da ${emp}. Em que posso ajudar?`
        : "Boa tarde! Sou o Tuma IA. Em que posso ajudar?";
    }
    if (/\bboa\s+noite\b/i.test(q)) {
      return emp
        ? `Boa noite! Sou o Tuma IA, da ${emp}. Em que posso ajudar?`
        : "Boa noite! Sou o Tuma IA. Em que posso ajudar?";
    }
    return emp
      ? `Oi! Sou o Tuma IA, assistente de criação de artes da ${emp}. O que você precisa hoje?`
      : "Oi! Sou o Tuma IA. O que você precisa hoje?";
  }

  const themed = tryPerfilGeralDirectResponse(q, emp);
  if (themed) return themed;

  if (CAPACIDADE_EXTRA_RE.test(q)) {
    if (/\bcomo\s+fa[cç]o\s+pra\s+pedir/i.test(q)) {
      return emp
        ? `Escreve o que quer — produto, formato, texto — tipo «monta um post do whey pro feed». Eu monto o resumo no painel da ${emp} pra você confirmar antes da prévia.`
        : "Escreve o pedido com clareza — produto e formato. O painel mostra o resumo antes da prévia.";
    }
    return emp
      ? `Consigo sim! Ajudo a ${emp} com posts, artes e produtos do acervo em Mídias.`
      : "Consigo sim! Ajudo com posts, artes e o que está em Mídias.";
  }

  return null;
}
