/** Texto padrão sugerido para geração de imagem no Tuma. */
export const EVITAR_PADRAO_IMAGEM =
  "Clipart genérico; textos ilegíveis ou distorcidos; layout copiado de posts antigos; cores fora da paleta da marca.";

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
  "Fundo poluído; muitos ícones; sombras exageradas",
  "Estilo infantil ou cartoon (salvo se pedido)",
  "Imagens genéricas de banco de imagens",
];

export const PRESETS_ASSINATURA_VISUAL = [
  "Tipografia condensada em caixa alta; headline dominante; produto central recortado; logo no topo; alto contraste",
  "Visual premium com produto protagonista; composição forte; marca sempre legível; impacto visual acima de ornamento",
];

export const PRESETS_VARIACOES_CAMPANHA = [
  "Cor principal muda por produto/categoria; fundo e props podem variar; CTA e selo entram quando fizer sentido comercial",
  "Campanhas podem alternar entre clean e promocional, mantendo produto herói, contraste alto e assinatura da marca",
];

export const PRESETS_REGRAS_REPETICAO = [
  "Logo no topo; headline curta e dominante; produto ocupa boa parte da arte; texto de apoio só o necessário",
  "Produto sempre como herói; composição promocional; evitar layout sem foco comercial ou sem hierarquia clara",
];

export const PRESETS_ESTRATEGIA_COR_CAMPANHA = [
  "Seguir linha de cor variável por campanha usando #FFFFFF como base neutra e ajustar a cor dominante conforme o produto, mantendo alto contraste",
  "Usar a paleta da marca como base fixa e trocar a cor de destaque conforme a categoria do produto, sem perder consistência visual",
];

/** Campos principais — o que mais guia artes no Tuma. */
export const CAMPOS_IMAGEM_PRINCIPAIS = [
  {
    key: "estilo_visual",
    label: "Estilo visual",
    hint: "Como a arte deve parecer — sem nomes de cor (use a paleta acima).",
    placeholder: "Ex.: limpo, moderno, fundo claro, tipografia bold",
    presets: PRESETS_ESTILO_VISUAL,
    multiline: true,
  },
  {
    key: "tom_voz",
    label: "Mood / atmosfera",
    hint: "Vira clima visual na imagem, não texto de legenda.",
    placeholder: "Ex.: confiante, acolhedor, premium",
    presets: PRESETS_MOOD_IMAGEM,
  },
  {
    key: "evitar",
    label: "Evitar nas artes",
    hint: "Reduz erros recorrentes da IA.",
    placeholder: EVITAR_PADRAO_IMAGEM,
    presets: PRESETS_EVITAR,
    multiline: true,
  },
  {
    key: "publico",
    label: "Público-alvo (visual)",
    hint: "Opcional — influencia estética (formal vs. jovem).",
    placeholder: "Ex.: famílias do bairro, profissionais 30–50 anos",
    presets: PRESETS_PUBLICO,
  },
];

export const CAMPOS_PADROES_VISUAIS = [
  {
    key: "assinatura_visual",
    label: "Assinatura visual",
    hint: "O que se repete quase sempre na marca: tipografia, contraste, produto, logo e composição.",
    placeholder:
      "Ex.: tipografia condensada em caixa alta, headline dominante, produto central recortado, logo no topo, alto contraste",
    presets: PRESETS_ASSINATURA_VISUAL,
    multiline: true,
  },
  {
    key: "variacoes_campanha",
    label: "Variações por campanha",
    hint: "O que pode mudar sem perder a identidade visual.",
    placeholder: "Ex.: cor principal por produto, fundo temático, CTA e selo promocional ocasionais",
    presets: PRESETS_VARIACOES_CAMPANHA,
    multiline: true,
  },
  {
    key: "regras_repeticao",
    label: "Regras de repetição",
    hint: "Regras recorrentes de layout e hierarquia que o Tuma deve manter.",
    placeholder: "Ex.: logo no topo, headline em até 2 linhas, produto herói ocupando 40–60% da arte",
    presets: PRESETS_REGRAS_REPETICAO,
    multiline: true,
  },
  {
    key: "estrategia_cor_campanha",
    label: "Estratégia de cor da campanha",
    hint: "Explique como a marca varia a cor por produto/campanha sem perder consistência.",
    placeholder:
      "Ex.: seguir linha de cor variável por campanha usando #FFFFFF como base neutra e ajustar a cor dominante conforme o produto",
    presets: PRESETS_ESTRATEGIA_COR_CAMPANHA,
    multiline: true,
  },
];

/** Campos secundários — mais úteis no chat do que na imagem. */
export const CAMPOS_IMAGEM_OPCIONAIS = [
  {
    key: "segmento",
    label: "Segmento",
    placeholder: "Ex.: ótica, restaurante, clínica",
  },
  {
    key: "sobre_empresa",
    label: "Sobre a empresa",
    hint: "Contexto para o chat; na imagem vale só o que for visual.",
    placeholder: "Em 1–2 frases: o que a empresa faz e para quem.",
    multiline: true,
  },
  {
    key: "exemplo_frase_marca",
    label: "Frase de exemplo (headline)",
    hint: "Estilo de título nas artes, não legenda longa.",
    placeholder: "Ex.: «Seu olhar, nossa paixão»",
  },
];
