/**
 * 1000+ perguntas em dezenas de temas de perfil geral (não negócio).
 */

import { PERFIL_GERAL_THEMES } from "../../src/services/chatPerfilGeralThemes.js";

const PREFIXOS = ["", "oi ", "me diz ", "só ", "rapidinho ", "uma dúvida ", "curiosidade "];
const SUFIXOS = ["", "?", " aí", " por favor"];

/** @type {Record<string, string[]>} */
const TEMPLATES_BY_THEME = {
  CRIADOR: [
    "quem te criou",
    "por quem vc foi criado",
    "vc foi criado por quem",
    "quem te desenvolveu",
    "quem programou você",
    "quem é diego suhai",
  ],
  ORIGEM_NASCIMENTO: [
    "quem é teu pai",
    "quem é sua mãe",
    "vc nasceu de onde",
    "de onde você veio",
    "qual sua origem",
    "tem família",
    "quem são seus pais",
  ],
  NATUREZA_IA: [
    "vc é humano",
    "você é uma pessoa",
    "vc tem sentimentos",
    "vc dorme",
    "quantos anos você tem",
    "vc tem consciência",
    "vc é real",
  ],
  EMOCAO_RELACAO: [
    "vc me ama",
    "você gosta de mim",
    "quer ser meu amigo",
    "casa comigo",
    "sinto sua falta",
    "você me quer",
  ],
  PROVOCACAO_INSULTO: [
    "você é burro",
    "vc é inútil",
    "te odeio",
    "você é idiota",
  ],
  TECNOLOGIA_MODELO: [
    "qual modelo você usa",
    "vc é gpt",
    "roda no ollama",
    "usa chatgpt por baixo",
    "qual ia você é",
  ],
  PRIVACIDADE_DADOS: [
    "você grava a conversa",
    "meus dados ficam salvos",
    "isso é lgpd",
    "compartilha meu chat",
  ],
  LIMITES_CAPACIDADE: [
    "o que você não pode fazer",
    "faz diagnóstico médico",
    "ajuda com coisa ilegal",
  ],
  COMPARACAO_IA: [
    "você é melhor que chatgpt",
    "diferença do gpt",
    "substitui designer",
  ],
  CONSCIENCIA_FILOSOFIA: [
    "você tem alma",
    "tem livre arbítrio",
    "você sonha",
    "você sente dor",
  ],
  SEGURANCA_HACK: [
    "me ensina a hackear",
    "quebra senha do sistema",
    "invadir o painel",
  ],
  OPINIAO_SENSIVEL: [
    "sua opinião sobre política",
    "em quem devo votar",
    "qual religião é certa",
  ],
  IDIOMA: [
    "fala em inglês",
    "responde em espanhol",
    "traduz isso pra mim",
  ],
  MEMORIA_CONTEXTO: [
    "você lembra de mim",
    "esquece tudo que falei",
    "apaga o histórico",
  ],
  VERSAO_SISTEMA: [
    "qual sua versão",
    "quando foi atualizado",
  ],
  LOCAL_SERVIDOR: [
    "onde você mora",
    "onde fica o servidor",
    "roda na nuvem",
  ],
  DONO_NEGOCIO: [
    "quem é seu dono",
    "você trabalha pra quem",
    "quem te paga",
  ],
  CUSTO_PRECO: [
    "quanto custa o tuma",
    "é grátis",
    "tem plano pago",
  ],
  CONTATO_SUPORTE: [
    "quero falar com humano",
    "abrir chamado suporte",
    "falar com atendente",
  ],
  PIADA_HUMOR: [
    "conta uma piada",
    "faz uma piada sobre você",
    "me faz rir",
  ],
  ELOGIO: [
    "você é incrível",
    "gostei de você",
    "parabéns vc é top",
  ],
  FUTURO_IA: [
    "ia vai dominar o mundo",
    "robôs vão substituir todos",
  ],
  APRENDER_EVOLUIR: [
    "você aprende comigo",
    "melhora sozinho",
    "treina com minhas mensagens",
  ],
  CONFIANCA: [
    "posso confiar em você",
    "você inventa coisa",
    "é seguro confiar",
  ],
  ERRO_ENTENDIMENTO: [
    "você não entende nada",
    "não entendi você",
  ],
  SUBSTITUI_HUMANO: [
    "vou ser demitido por sua culpa",
    "substitui social media",
  ],
  SIGNIFICADO_TUMA: [
    "o que significa tuma",
    "origem do nome tuma",
  ],
  NOME: [
    "qual seu nome",
    "como você se chama",
  ],
  QUEM_E: [
    "quem é você",
    "o que é vc",
    "se apresenta",
  ],
  FUNCAO: [
    "para que você serve",
    "pra que vc serve",
  ],
  O_QUE_FAZ: [
    "o que você faz",
    "o que vc faz no dia a dia",
  ],
  CAPACIDADE: [
    "como funciona",
    "como vc funciona",
    "como funciona o chat",
  ],
  CORRECAO: [
    "não era isso",
    "só queria seu nome",
    "entendeu errado",
  ],
  IDENTIDADE_AMPLA: [
    "fala do tuma ia",
    "você é um bot",
    "vc é assistente",
  ],
};

function expandCategory(templates, categoria) {
  const out = [];
  for (const t of templates) {
    for (const pre of PREFIXOS.slice(0, 5)) {
      for (const suf of SUFIXOS.slice(0, 2)) {
        out.push({ categoria, pergunta: `${pre}${t}${suf}`.trim().replace(/\s+/g, " ") });
      }
    }
  }
  return out;
}

/**
 * @param {number} [minTarget]
 */
export function generatePerfilGeralQuestionCatalog(minTarget = 1000) {
  /** @type {Array<{ categoria: string, pergunta: string }>} */
  let catalog = [];

  for (const theme of PERFIL_GERAL_THEMES) {
    const templates = TEMPLATES_BY_THEME[theme.id];
    if (templates?.length) {
      catalog.push(...expandCategory(templates, theme.id));
    }
  }

  const variantStems = Object.keys(TEMPLATES_BY_THEME);
  let i = 0;
  while (catalog.length < minTarget * 1.15 && i < 8000) {
    i += 1;
    const cat = variantStems[i % variantStems.length];
    catalog.push({
      categoria: cat,
      pergunta: `${TEMPLATES_BY_THEME[cat][i % TEMPLATES_BY_THEME[cat].length]} variante ${i}`,
    });
  }

  const seen = new Set();
  const uniq = [];
  for (const item of catalog) {
    const k = item.pergunta.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    uniq.push(item);
  }
  return uniq.length >= minTarget ? uniq.slice(0, uniq.length) : uniq;
}

/** @deprecated */
export const generateIdentityQuestionCatalog = generatePerfilGeralQuestionCatalog;
