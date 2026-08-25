import { EVITAR_PADRAO_IMAGEM } from "./identidadeMarcaPresets";
import { normalizeHexColor } from "./identidadeMarcaUi";

/** Campos que entram no prompt de geração de imagem (espelha backend). */
export const CAMPOS_CRITICOS_IMAGEM = [
  "cor_primaria",
  "estilo_visual",
  "assinatura_visual",
  "evitar",
  "id_midia_logo",
];

export const GRUPOS_TREINO_IMAGEM = [
  {
    id: "paleta",
    title: "Paleta",
    subtitle: "Cores obrigatórias na composição — a IA não inventa fora daqui.",
    badge: "Imagem",
  },
  {
    id: "look",
    title: "Look da arte",
    subtitle: "Estilo, assinatura, mood e anti-padrões — vão direto no briefing visual.",
    badge: "Imagem",
  },
  {
    id: "composicao",
    title: "Composição recorrente",
    subtitle: "Hierarquia, layout e variação por campanha sem perder a marca.",
    badge: "Imagem",
  },
  {
    id: "refinamento",
    title: "Refinamentos",
    subtitle: "Público, headline e contexto — influenciam a arte e o chat.",
    badge: "Imagem + chat",
  },
];

function coletarCores(dados) {
  const cores = [];
  for (const hex of [dados?.cor_primaria, dados?.cor_secundaria, ...(dados?.cores_adicionais || [])]) {
    const v = normalizeHexColor(hex);
    if (!v || cores.includes(v)) continue;
    cores.push(v);
  }
  return cores;
}

function trim(value, max = 220) {
  const s = String(value ?? "").trim();
  if (!s) return "";
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

/**
 * Linhas legíveis do que a IA injeta na geração de imagem.
 * @param {Record<string, unknown>} dados
 */
export function buildPreviewLinhasImagem(dados) {
  const d = dados && typeof dados === "object" ? dados : {};
  const linhas = [];
  const cores = coletarCores(d);

  if (cores.length) {
    linhas.push({ id: "cores", label: "Paleta", value: cores.join(", "), ok: true });
  } else {
    linhas.push({ id: "cores", label: "Paleta", value: "Defina ao menos a cor primária.", ok: false });
  }

  if (trim(d.estilo_visual)) {
    linhas.push({ id: "estilo", label: "Estilo visual", value: trim(d.estilo_visual), ok: true });
  } else {
    linhas.push({ id: "estilo", label: "Estilo visual", value: "Ex.: limpo, premium, alto contraste.", ok: false });
  }

  if (trim(d.assinatura_visual)) {
    linhas.push({ id: "assinatura", label: "Assinatura visual", value: trim(d.assinatura_visual), ok: true });
  } else {
    linhas.push({
      id: "assinatura",
      label: "Assinatura visual",
      value: "Tipografia, produto herói, logo, contraste…",
      ok: false,
    });
  }

  const evitar = trim(d.evitar) || EVITAR_PADRAO_IMAGEM;
  linhas.push({
    id: "evitar",
    label: "Evitar nas artes",
    value: evitar,
    ok: Boolean(trim(d.evitar) || trim(d.id_midia_logo)),
  });

  if (trim(d.tom_voz)) {
    linhas.push({ id: "mood", label: "Mood / atmosfera", value: trim(d.tom_voz, 120), ok: true });
  }

  if (trim(d.regras_repeticao)) {
    linhas.push({ id: "regras", label: "Regras de layout", value: trim(d.regras_repeticao), ok: true });
  }
  if (trim(d.variacoes_campanha)) {
    linhas.push({ id: "variacoes", label: "Variações por campanha", value: trim(d.variacoes_campanha), ok: true });
  }
  if (trim(d.estrategia_cor_campanha)) {
    linhas.push({
      id: "estrategia_cor",
      label: "Estratégia de cor",
      value: trim(d.estrategia_cor_campanha),
      ok: true,
    });
  }

  if (trim(d.publico)) {
    linhas.push({ id: "publico", label: "Público (estética)", value: trim(d.publico, 120), ok: true });
  }
  if (trim(d.exemplo_frase_marca)) {
    linhas.push({ id: "headline", label: "Estilo de headline", value: `«${trim(d.exemplo_frase_marca, 80)}»`, ok: true });
  }

  const temLogo = Boolean(String(d.id_midia_logo ?? "").trim());
  linhas.push({
    id: "logo",
    label: "Logo nas artes",
    value: temLogo ? "Marca d'água discreta no canto (PNG cadastrado)." : "Sem logo — a IA não inventa logotipo.",
    ok: temLogo,
  });

  return linhas;
}

/**
 * @param {Record<string, unknown>} dados
 */
export function calcTreinoImagemStatus(dados) {
  const d = dados && typeof dados === "object" ? dados : {};
  const checks = [
    { key: "cor_primaria", ok: Boolean(normalizeHexColor(d.cor_primaria)) },
    { key: "estilo_visual", ok: Boolean(trim(d.estilo_visual)) },
    { key: "assinatura_visual", ok: Boolean(trim(d.assinatura_visual)) },
    {
      key: "evitar",
      ok: Boolean(trim(d.evitar) || String(d.id_midia_logo ?? "").trim()),
    },
    { key: "id_midia_logo", ok: Boolean(String(d.id_midia_logo ?? "").trim()) },
  ];
  const ok = checks.filter((c) => c.ok).length;
  const pronto =
    checks.find((c) => c.key === "cor_primaria")?.ok &&
    checks.find((c) => c.key === "estilo_visual")?.ok &&
    (checks.find((c) => c.key === "evitar")?.ok || checks.find((c) => c.key === "id_midia_logo")?.ok);

  return {
    total: checks.length,
    ok,
    pronto_para_imagem: Boolean(pronto),
    faltando: checks.filter((c) => !c.ok).map((c) => c.key),
  };
}
