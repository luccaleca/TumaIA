/**
 * Catálogo curado de modelos de post (playbooks visuais).
 * O lojista ativa/desativa; produto, preço e cores vêm do pedido e da identidade.
 */

/** @typedef {{ zona: string, conteudo: string }} EstruturaZona */

/**
 * @typedef {{
 *   slug: string,
 *   tipo: import("./shared.js").ContextoTipo,
 *   nome: string,
 *   tagline: string,
 *   descricao: string,
 *   quando_usar: string[],
 *   diferencial: string[],
 *   exemploImagemUrl: string,
 *   enfase: string[],
 *   estrutura: EstruturaZona[],
 *   prompt_base: string,
 * }} PostModeloCatalogItem
 */

/** @type {PostModeloCatalogItem[]} */
export const POST_MODELOS_CATALOG = [
  {
    slug: "promocao",
    tipo: "promocao",
    nome: "Promoção",
    tagline: "Oferta e preço em destaque — para vender com urgência",
    descricao:
      "Cada modelo de post organiza a arte de um jeito. Promoção é o playbook para campanhas comerciais: o que importa é a condição que você informa no chat (desconto, combo, preço especial) junto com o produto do acervo. Diferente de Lançamento, que vende novidade, ou de Produto, que mostra o item no dia a dia — aqui o foco é converter com oferta clara e prazo.",
    quando_usar: [
      "Desconto, combo ou preço promocional (ex.: 2 por R$ 149, 30% off)",
      "Campanhas com validade — fim de semana, estoque limitado, últimas unidades",
      "Black Friday, queima de estoque ou ação relâmpago no Instagram",
      "Quando o cliente precisa bater o olho no número ou na condição no feed",
    ],
    diferencial: [
      "O preço ou a condição ficam grandes na arte — dá para entender a oferta só de bater o olho",
      "Produto aparece, mas o número não fica escondido no canto",
      "Usa só o desconto, combo ou validade que você passar no chat",
    ],
    exemploImagemUrl: "/imagens/modelos/promocao-exemplo.png",
    enfase: [
      "Preço, combo ou condição promocional em tipografia grande e legível",
      "Validade ou urgência visível (até domingo, últimas unidades)",
      "Produto do acervo em destaque sem competir com a oferta",
    ],
    estrutura: [
      { zona: "Topo", conteudo: "Gancho ou nome curto da campanha" },
      { zona: "Centro", conteudo: "Produto em destaque (foto do acervo)" },
      { zona: "Inferior", conteudo: "Preço / combo e chamada para ação" },
    ],
    prompt_base: [
      "Modelo PROMOÇÃO para Instagram.",
      "Hierarquia: gancho curto no topo, produto herói no centro, preço/condição promocional em destaque na parte inferior.",
      "Tipografia grande para números e ofertas citadas pelo cliente.",
      "Fundo que não compete com o produto; cores da marca.",
      "Não inventar preço — usar só o que o cliente pediu.",
    ].join("\n"),
  },
  {
    slug: "lancamento",
    tipo: "lancamento",
    nome: "Lançamento",
    tagline: "Produto novo em destaque, gancho de novidade",
    descricao: "",
    quando_usar: [],
    diferencial: [
      "Deixa claro que é coisa nova, sem cara de promoção ou liquidação",
      "Produto em destaque, com visual de estreia",
      "Bom para destacar sabor, benefício ou o que torna o lançamento especial",
    ],
    exemploImagemUrl: "/imagens/modelos/lancamento-exemplo.png",
    enfase: [
      "Produto como protagonista (40–60% da arte)",
      "Gancho de novidade: Chegou, Novo, Lançamento",
      "Atributo-chave: sabor (alimentos) ou benefício (suplementos)",
    ],
    estrutura: [
      { zona: "Topo", conteudo: "Selo ou frase de lançamento" },
      { zona: "Centro", conteudo: "Produto herói com boa iluminação" },
      { zona: "Rodapé", conteudo: "Benefício ou sabor + CTA leve" },
    ],
    prompt_base: [
      "Modelo LANÇAMENTO de produto para Instagram.",
      "Produto herói centralizado; gancho de novidade no topo.",
      "Se o pedido citar sabor (comestível) ou benefício (suplemento), destacar de forma legível.",
      "Visual limpo, premium, sem poluição; cores e logo da marca.",
      "Não inventar nome de produto — usar mídia e pedido do cliente.",
    ].join("\n"),
  },
  {
    slug: "produto",
    tipo: "produto",
    nome: "Produto",
    tagline: "No dia a dia — produto ou serviço em uso, na prática",
    descricao:
      "Para mostrar o que você vende em contexto real: na rotina, no uso, no ambiente do cliente. Não é promoção (sem preço em destaque) nem lançamento (sem selo de novidade). Serve para qualquer ramo — físico ou serviço — quando o pedido no chat é “mostra o produto na prática”.",
    quando_usar: [
      "Produto em uso: pós-treino, café da manhã, prateleira, atendimento",
      "Serviço na prática: consultório, salão, obra, aula — o que fizer sentido",
      "Posts do dia a dia no feed, entre campanhas comerciais",
      "Quando o pedido é “post bonito do produto”, não “oferta” nem “lançamento”",
    ],
    diferencial: [
      "Parece cena do dia a dia — não panfleto com preço ou selo de novidade",
      "Mostra o produto ou serviço no uso, no ambiente que fizer sentido",
      "Dá para pedir tema de data, rotina ou ocasião no chat sem mudar de modelo",
    ],
    exemploImagemUrl: "/imagens/modelos/produto-exemplo.png",
    enfase: [
      "Ambiente e contexto de uso (casa, loja, trabalho, rotina)",
      "Produto ou serviço integrado à cena — natural, na prática",
      "Frase leve; pouco texto comercial",
    ],
    estrutura: [
      { zona: "Topo", conteudo: "Logo + cena ou ambiente do dia a dia" },
      { zona: "Centro", conteudo: "Produto/serviço em uso (mídia do acervo)" },
      { zona: "Inferior", conteudo: "Frase principal + CTA suave (sem preço em destaque)" },
    ],
    prompt_base: [
      "Modelo PRODUTO (dia a dia) para Instagram.",
      "Produto ou serviço integrado a uma cena real de uso ou ambiente aspiracional.",
      "Tom de rotina, uso na prática ou desejo — não campanha promocional nem lançamento.",
      "Evitar preços, descontos, urgência e selos de novidade salvo se o cliente pedir no chat.",
      "Cores da marca; logo discreta; tipografia leve na frase pedida.",
    ].join("\n"),
  },
  {
    slug: "mensagens",
    tipo: "mensagens",
    nome: "Mensagens",
    tagline: "Recado e frase em destaque — o texto manda",
    descricao:
      "Para comunicar uma ideia, aviso ou frase sem montar campanha de venda. O texto é o protagonista da arte; produto e logo entram como apoio se o pedido no chat pedir. Diferente de Promoção (preço), Lançamento (novidade) e Produto (cena do dia a dia) — aqui é um recado direto ao seguidor.",
    quando_usar: [
      "Avisos: horário especial, recesso, mudança de endereço, estamos de volta",
      "Agradecimento, recado ao cliente, comunicado curto",
      "Frase de impacto, citação ou mensagem motivacional da marca",
      "Quando o pedido no chat é o texto — não “oferta”, “lançamento” nem foto de produto em cena",
    ],
    diferencial: [
      "O recado que você escreve vira o centro da arte",
      "Layout limpo, pensado para ler rápido no celular",
      "Foto ou produto só aparecem se você pedir — e ficam em segundo plano",
    ],
    exemploImagemUrl: "/imagens/modelos/mensagens-exemplo.png",
    enfase: [
      "Mensagem principal grande e fácil de ler no celular",
      "Fundo que não compete com o texto (cores da marca)",
      "Logo discreta; mídia opcional e pequena",
    ],
    estrutura: [
      { zona: "Topo", conteudo: "Logo discreta" },
      { zona: "Centro", conteudo: "Mensagem principal (texto do chat)" },
      { zona: "Inferior", conteudo: "Complemento ou CTA suave (opcional)" },
    ],
    prompt_base: [
      "Modelo MENSAGENS para Instagram.",
      "Texto/recado citado pelo cliente é o elemento visual dominante — tipografia grande, alto contraste, leitura fácil no feed.",
      "Layout limpo; cores da identidade; logo discreta.",
      "Produto ou mídia do acervo só se o pedido mencionar — em tamanho de apoio, nunca competindo com o texto.",
      "Evitar preços, urgência promocional e selos de lançamento salvo se o cliente pedir explicitamente.",
    ].join("\n"),
  },
];

const SLUG_SET = new Set(POST_MODELOS_CATALOG.map((m) => m.slug));

/** Slugs fixos do catálogo — espelham CHECK no banco. */
export const POST_MODELO_SLUGS = POST_MODELOS_CATALOG.map((m) => m.slug);

/**
 * @param {string} slug
 */
export function getPostModeloBySlug(slug) {
  const s = String(slug || "").trim();
  return POST_MODELOS_CATALOG.find((m) => m.slug === s) || null;
}

/**
 * @param {string} slug
 */
export function isPostModeloSlug(slug) {
  return SLUG_SET.has(String(slug || "").trim());
}

/**
 * @param {Record<string, unknown> | null | undefined} row
 */
export function playbookSlugFromContextoRow(row) {
  if (!row || typeof row !== "object") return null;
  const dados = row.dados_json && typeof row.dados_json === "object" ? row.dados_json : {};
  if (dados.playbook === true && typeof dados.playbook_slug === "string" && dados.playbook_slug.trim()) {
    const slug = dados.playbook_slug.trim();
    if (slug === "data_comemorativa" || slug === "lifestyle") return "produto";
    if (slug === "institucional") return "mensagens";
    return slug;
  }
  if (dados.playbook === true && typeof dados.tipo === "string") {
    const byTipo = POST_MODELOS_CATALOG.find((m) => m.tipo === dados.tipo);
    if (byTipo) return byTipo.slug;
  }
  return null;
}

/**
 * Prompt de layout do modelo de post (playbook) para injeção na geração de imagem.
 *
 * @param {Record<string, unknown> | null | undefined} row
 * @returns {string | null}
 */
export function resolvePlaybookPromptFromContextoRow(row) {
  if (!row || typeof row !== "object") return null;
  const dados = row.dados_json && typeof row.dados_json === "object" ? row.dados_json : {};
  if (typeof dados.prompt_base === "string" && dados.prompt_base.trim()) {
    return dados.prompt_base.trim();
  }
  const slug = playbookSlugFromContextoRow(row);
  if (!slug) return null;
  const modelo = getPostModeloBySlug(slug);
  return modelo?.prompt_base?.trim() || null;
}

/**
 * @param {Record<string, unknown>} modelo
 */
export function buildPlaybookDadosJson(modelo) {
  return {
    tipo: modelo.tipo,
    playbook: true,
    playbook_slug: modelo.slug,
    prompt_base: modelo.prompt_base,
    enfase: modelo.enfase,
    estrutura: modelo.estrutura,
    tagline: modelo.tagline,
  };
}
