/** Texto padrão sugerido — veto absoluto nas artes (anti-IA). */
export const EVITAR_PADRAO_IMAGEM =
  "Layout genérico de IA; clipart; tipografia genérica; logo só no rodapé; textos ilegíveis; cores fora da paleta; embalagem redesenhada.";

export const PRESETS_ESTILO_VISUAL = [
  "Limpo e moderno, fundo claro, bastante respiro",
  "Premium e elegante, tipografia forte",
  "Colorido e energético, alto contraste",
  "Minimalista, poucos elementos, foco no produto",
  "Corporativo profissional, organizado",
  "Acolhedor e humano, fotos naturais",
];

export const PRESETS_MOOD_IMAGEM = [
  "Confiante e profissional",
  "Acolhedor e próximo",
  "Moderno e dinâmico",
  "Premium e sofisticado",
  "Divertido e leve",
  "Urgente e promocional",
];

export const PRESETS_PUBLICO = [
  "Consumidor final local",
  "Famílias e bairro",
  "Profissionais e empresas",
  "Jovens 18–35 anos",
  "Público premium",
];

export const PRESETS_EVITAR = [
  EVITAR_PADRAO_IMAGEM,
  "Fundo poluído; muitos ícones; sombras exageradas; cara de banco de imagens",
  "Estilo infantil ou cartoon (salvo se pedido)",
  "Composição sem hierarquia; produto pequeno demais; marca ilegível",
];

export const PRESETS_ASSINATURA_VISUAL = [
  "Tipografia condensada em caixa alta; headline dominante; produto central recortado; logo no canto; alto contraste",
  "Visual premium com produto protagonista; composição forte; marca sempre legível; impacto acima de ornamento",
];

export const PRESETS_VARIACOES_CAMPANHA = [
  "Cor de destaque pode mudar por produto; fundo e props variam; CTA e selo só quando fizer sentido comercial",
  "Alternar clean e promocional sem perder produto herói, contraste e assinatura da marca",
];

export const PRESETS_REGRAS_REPETICAO = [
  "Logo discreta no canto; headline curta e dominante; produto ocupa boa parte da arte; texto de apoio só o necessário",
  "Produto sempre como herói; hierarquia clara; nunca layout genérico sem foco comercial",
];

export const PRESETS_ESTRATEGIA_COR_CAMPANHA = [
  "Paleta da marca fixa; cor de destaque pode acompanhar o produto, mantendo alto contraste",
  "Base neutra (#FFFFFF ou fundo limpo) + cor dominante da marca; nunca inventar paleta nova",
];

/** Lei 2–3 — jeito visual (obrigatório nas artes). */
export const CAMPOS_JEITO_ARTE = [
  {
    key: "estilo_visual",
    label: "Estilo visual",
    hint: "Obrigatório — como a arte deve parecer. Sem nomes de cor (use a paleta).",
    placeholder: "Ex.: limpo, moderno, fundo claro, tipografia bold",
    presets: PRESETS_ESTILO_VISUAL,
    multiline: true,
    obrigatorio: true,
  },
  {
    key: "assinatura_visual",
    label: "Assinatura visual",
    hint: "Obrigatório — o DNA que se repete: tipografia, produto, logo, contraste.",
    placeholder:
      "Ex.: tipografia condensada, headline dominante, produto central, logo no canto, alto contraste",
    presets: PRESETS_ASSINATURA_VISUAL,
    multiline: true,
    obrigatorio: true,
  },
];

/** Lei 4 — veto anti-IA. */
export const CAMPOS_EVITAR = [
  {
    key: "evitar",
    label: "Evitar nas artes (veto)",
    hint: "Obrigatório — o Tuma trata isto como proibição, não como sugestão.",
    placeholder: EVITAR_PADRAO_IMAGEM,
    presets: PRESETS_EVITAR,
    multiline: true,
    obrigatorio: true,
  },
];

/** Voz da marca — textos novos no estilo, não frase fixa. */
export const CAMPOS_VOZ = [
  {
    key: "tom_voz",
    label: "Tom / mood",
    hint: "Clima da arte e do texto. O Tuma cria frases novas neste tom.",
    placeholder: "Ex.: confiante, acolhedor, premium",
    presets: PRESETS_MOOD_IMAGEM,
  },
  {
    key: "exemplo_frase_marca",
    label: "Frase de exemplo (estilo)",
    hint: "Referência de headline — não é texto fixo copiado em todo post.",
    placeholder: "Ex.: «Seu olhar, nossa paixão»",
  },
  {
    key: "publico",
    label: "Público-alvo (visual)",
    hint: "Opcional — influencia estética (formal vs. jovem).",
    placeholder: "Ex.: famílias do bairro, profissionais 30–50 anos",
    presets: PRESETS_PUBLICO,
  },
];

/** Composição avançada — ainda entra no prompt, mas secundário. */
export const CAMPOS_COMPOSICAO = [
  {
    key: "regras_repeticao",
    label: "Regras de layout",
    hint: "Hierarquia recorrente que o Tuma deve manter.",
    placeholder: "Ex.: logo no canto, headline em até 2 linhas, produto herói 40–60%",
    presets: PRESETS_REGRAS_REPETICAO,
    multiline: true,
  },
  {
    key: "variacoes_campanha",
    label: "O que pode variar",
    hint: "O que muda entre campanhas sem perder a identidade.",
    placeholder: "Ex.: cor de destaque por produto, fundo temático, CTA ocasional",
    presets: PRESETS_VARIACOES_CAMPANHA,
    multiline: true,
  },
  {
    key: "estrategia_cor_campanha",
    label: "Estratégia de cor",
    hint: "Como variar cor por campanha sem sair da paleta.",
    placeholder: "Ex.: base neutra + cor dominante da marca conforme o produto",
    presets: PRESETS_ESTRATEGIA_COR_CAMPANHA,
    multiline: true,
  },
];

/** Contexto — mais chat do que pixels. */
export const CAMPOS_CONTEXTO = [
  {
    key: "segmento",
    label: "Segmento",
    placeholder: "Ex.: ótica, restaurante, clínica",
  },
  {
    key: "sobre_empresa",
    label: "Sobre a empresa",
    hint: "Contexto para o chat; na arte vale o que for visual.",
    placeholder: "Em 1–2 frases: o que a empresa faz e para quem.",
    multiline: true,
  },
];

/** Compat: lista plana usada em merges/legado. */
export const CAMPOS_IMAGEM_PRINCIPAIS = [...CAMPOS_JEITO_ARTE, ...CAMPOS_EVITAR, CAMPOS_VOZ[2]];
export const CAMPOS_PADROES_VISUAIS = [CAMPOS_JEITO_ARTE[1], ...CAMPOS_COMPOSICAO];
export const CAMPOS_IMAGEM_OPCIONAIS = CAMPOS_CONTEXTO;
