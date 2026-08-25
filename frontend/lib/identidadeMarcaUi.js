import { authApiFetchWithToken } from "./auth";
import { assignRankedPalette, normalizeHexColor as normalizeHexBrand } from "./brandColorScore.js";

export const MAX_FOTOS_IDENTIDADE = 8;

/** Tamanho recomendado para logo nas artes (mínimo 512 px desativado temporariamente). */
export const LOGO_IDENTIDADE_IDEAL_LADO_MAIOR_PX = 1024;

/** Nome fixo do contexto de identidade (um por empresa) — não listar em /painel/contextos. */
export const IDENTIDADE_CONTEXTO_NOME = "Identidade da marca";
export const IDENTIDADE_TIPO = "identidade_marca";

/**
 * Linha bruta da API (`contexto_empresa`) ou item normalizado com `.row`.
 * @param {Record<string, unknown> | null | undefined} row
 */
export function isIdentidadeMarcaContextoRow(row) {
  if (!row || typeof row !== "object") return false;
  const base = row.row && typeof row.row === "object" ? row.row : row;
  const schema = base.schema_json;
  const dados = base.dados_json;
  if (schema && typeof schema === "object" && schema.tipo === IDENTIDADE_TIPO) return true;
  if (dados && typeof dados === "object" && dados.tipo === IDENTIDADE_TIPO) return true;
  const nome = String(base.nome ?? "")
    .trim()
    .toLowerCase();
  return nome === IDENTIDADE_CONTEXTO_NOME.toLowerCase();
}

/** Análise de fotos (vision); abaixo do proxy do Next (~320s) e do backend (240s). */
export const IDENTIDADE_ANALISE_TIMEOUT_MS = 270_000;

/** Cores de placeholder antigas do formulário — não tratar como escolha do usuário. */
export const CORES_PLACEHOLDER_FORM = ["#6B2D9E", "#D4AF37"];

export const emptyDados = {
  sobre_empresa: "",
  segmento: "",
  tom_voz: "",
  estilo_visual: "",
  assinatura_visual: "",
  variacoes_campanha: "",
  regras_repeticao: "",
  estrategia_cor_campanha: "",
  evitar: "",
  publico: "",
  cor_primaria: "",
  cor_secundaria: "",
  cores_adicionais: [],
  exemplo_frase_marca: "",
  site_url: "",
  id_midia_referencia_analise: null,
  id_midia_logo: null,
  legenda_referencia: "",
  papel_agente: "",
};

const HEX_RE = /^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})$/;

/** @param {unknown} v */
export function normalizeHexColor(v) {
  if (v == null) return null;
  let s = String(v).trim();
  if (!s) return null;
  if (!s.startsWith("#")) s = `#${s}`;
  if (!HEX_RE.test(s)) return null;
  if (s.length === 4) {
    const r = s[1];
    const g = s[2];
    const b = s[3];
    s = `#${r}${r}${g}${g}${b}${b}`;
  }
  return s.toUpperCase();
}

/** Checklist leve — o que a arte precisa. */
export const PILARES_COMPLETUDE = [
  { key: "id_midia_logo", label: "Logo", obrigatorio: true },
  { key: "cor_primaria", label: "Cores", obrigatorio: true },
  { key: "estilo_visual", label: "Estilo", obrigatorio: true },
  { key: "papel_agente", label: "Papel", obrigatorio: false },
  { key: "evitar", label: "Evitar", obrigatorio: false },
];

/** @deprecated */
export const PILAR_LOGO = { key: "id_midia_logo", label: "Logo" };

const MERGE_KEYS = [
  "sobre_empresa",
  "segmento",
  "tom_voz",
  "estilo_visual",
  "assinatura_visual",
  "variacoes_campanha",
  "regras_repeticao",
  "estrategia_cor_campanha",
  "evitar",
  "publico",
  "cor_primaria",
  "cor_secundaria",
  "cores_adicionais",
  "exemplo_frase_marca",
];

export const CORES_ADICIONAIS_MAX = 4;

/** @param {unknown} raw */
export function normalizeCoresAdicionaisList(raw) {
  const list = Array.isArray(raw) ? raw : [];
  const out = [];
  for (const item of list) {
    const hex = normalizeHexColor(item);
    if (!hex || out.includes(hex)) continue;
    out.push(hex);
    if (out.length >= CORES_ADICIONAIS_MAX) break;
  }
  return out;
}

export function dadosFromApi(raw) {
  if (!raw || typeof raw !== "object") return { ...emptyDados };
  return {
    sobre_empresa: raw.sobre_empresa || "",
    segmento: raw.segmento || "",
    tom_voz: raw.tom_voz || "",
    estilo_visual: raw.estilo_visual || "",
    assinatura_visual: raw.assinatura_visual || "",
    variacoes_campanha: raw.variacoes_campanha || "",
    regras_repeticao: raw.regras_repeticao || "",
    estrategia_cor_campanha: raw.estrategia_cor_campanha || "",
    evitar: raw.evitar || "",
    publico: raw.publico || "",
    cor_primaria: normalizeHexColor(raw.cor_primaria) || "",
    cor_secundaria: normalizeHexColor(raw.cor_secundaria) || "",
    cores_adicionais: normalizeCoresAdicionaisList(raw.cores_adicionais),
    exemplo_frase_marca: raw.exemplo_frase_marca || "",
    site_url: raw.site_url || "",
    id_midia_referencia_analise: raw.id_midia_referencia_analise || null,
    id_midia_logo: raw.id_midia_logo || null,
    legenda_referencia: raw.legenda_referencia || "",
    papel_agente: String(raw.papel_agente || raw.texto_livre || "").trim(),
  };
}

/**
 * @param {Record<string, string>} dados
 */
/** Há conteúdo de identidade já salvo ou analisado (não só cores padrão vazias). */
export function temConteudoIdentidade(dados) {
  if (!dados || typeof dados !== "object") return false;
  return Boolean(
    String(dados.papel_agente ?? "").trim() ||
      String(dados.sobre_empresa ?? "").trim() ||
      String(dados.tom_voz ?? "").trim() ||
      String(dados.estilo_visual ?? "").trim() ||
      String(dados.assinatura_visual ?? "").trim() ||
      String(dados.variacoes_campanha ?? "").trim() ||
      String(dados.regras_repeticao ?? "").trim() ||
      String(dados.estrategia_cor_campanha ?? "").trim() ||
      String(dados.segmento ?? "").trim() ||
      String(dados.publico ?? "").trim() ||
      String(dados.evitar ?? "").trim() ||
      String(dados.exemplo_frase_marca ?? "").trim() ||
      String(dados.id_midia_logo ?? "").trim(),
  );
}

export function calcCompletudeLocal(dados) {
  const d = dados || {};
  const temPapel = String(d.papel_agente ?? "").trim().length >= 40;
  const temJeito =
    Boolean(String(d.estilo_visual ?? "").trim()) ||
    Boolean(String(d.assinatura_visual ?? "").trim()) ||
    temPapel;
  const checks = PILARES_COMPLETUDE.map(({ key }) => {
    if (key === "estilo_visual") return { key, ok: temJeito };
    if (key === "papel_agente") return { key, ok: temPapel };
    return { key, ok: Boolean(String(d[key] ?? "").trim()) };
  });
  const done = checks.filter((c) => c.ok).length;
  return {
    percentual: Math.round((done / checks.length) * 100),
    pronto_para_imagem:
      Boolean(String(d.id_midia_logo ?? "").trim()) &&
      Boolean(String(d.cor_primaria ?? "").trim()) &&
      temJeito,
    faltando: checks.filter((c) => !c.ok).map((c) => c.key),
  };
}

/**
 * Preview amigável do que a arte vai usar.
 * @param {Record<string, unknown>} dados
 * @param {{ nome_fantasia?: string } | null} [empresa]
 */
export function buildLeisMarcaPreview(dados, empresa = null) {
  const d = dados || {};
  const nome = String(empresa?.nome_fantasia || "").trim() || "sua marca";
  const cores = [
    d.cor_primaria,
    d.cor_secundaria,
    ...(Array.isArray(d.cores_adicionais) ? d.cores_adicionais : []),
  ]
    .map((c) => String(c || "").trim())
    .filter(Boolean);
  const leis = [];
  if (String(d.id_midia_logo || "").trim()) leis.push("Logo oficial");
  if (cores.length) leis.push(`Cores: ${cores.join(" · ")}`);
  if (String(d.estilo_visual || "").trim()) leis.push(`Estilo: ${String(d.estilo_visual).trim()}`);
  if (String(d.evitar || "").trim()) leis.push(`Evitar: ${String(d.evitar).trim()}`);
  const papel = String(d.papel_agente || "").trim();
  if (papel) {
    const snippet = papel.length > 160 ? `${papel.slice(0, 159)}…` : papel;
    leis.push(`Papel: ${snippet}`);
  } else {
    leis.push("Papel em branco ainda vazio — escreva como a marca fala e se apresenta");
  }
  leis.push("Produto: PNG do acervo, sem redesenhar");
  return {
    titulo: nome,
    leis,
    pronto: calcCompletudeLocal(d).pronto_para_imagem,
  };
}

/**
 * Preenche só campos vazios; respeita campos editados manualmente.
 * @param {Record<string, string>} current
 * @param {Record<string, unknown>} sugestao
 * @param {Set<string>} [lockedFields]
 */
export function mergeIdentidadeSugestao(current, sugestao, lockedFields = new Set()) {
  const out = { ...current };
  if (!sugestao || typeof sugestao !== "object") return out;

  for (const key of MERGE_KEYS) {
    if (lockedFields.has(key)) continue;
    const next = sugestao[key];
    if (next == null || String(next).trim() === "") continue;

    if (key === "cor_primaria" || key === "cor_secundaria" || key === "cores_adicionais") {
      continue;
    }

    const cur = String(out[key] ?? "").trim();
    if (!cur) out[key] = String(next).trim();
  }

  if (
    !lockedFields.has("cor_primaria") &&
    !lockedFields.has("cor_secundaria") &&
    !lockedFields.has("cores_adicionais")
  ) {
    const palette = assignRankedPalette([
      out.cor_primaria,
      out.cor_secundaria,
      ...(Array.isArray(out.cores_adicionais) ? out.cores_adicionais : []),
      sugestao.cor_primaria,
      sugestao.cor_secundaria,
      ...(Array.isArray(sugestao.cores_adicionais) ? sugestao.cores_adicionais : []),
    ].map((c) => normalizeHexBrand(c) || normalizeHexColor(c)).filter(Boolean));
    out.cor_primaria = palette.cor_primaria;
    out.cor_secundaria = palette.cor_secundaria;
    out.cores_adicionais = normalizeCoresAdicionaisList(palette.cores_adicionais);
  }

  return out;
}

/** @param {string} value */
export function corEPlaceholderLegado(value) {
  const hex = normalizeHexColor(value);
  if (!hex) return true;
  return CORES_PLACEHOLDER_FORM.includes(hex);
}

export function toBase64WithoutPrefix(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const full = String(reader.result || "");
      const idx = full.indexOf(",");
      resolve(idx >= 0 ? full.slice(idx + 1) : full);
    };
    reader.onerror = () => reject(new Error("Falha ao ler arquivo."));
    reader.readAsDataURL(file);
  });
}

function getTipoMidia(file) {
  if (file.type.startsWith("image/")) return "imagem";
  return "outro";
}

/**
 * @param {string} empresaId
 * @param {File} file
 * @param {string | null} [idPasta]
 */
/**
 * Upload no acervo geral (painel Mídias).
 * @param {string} empresaId
 * @param {File} file
 * @param {string | null} [idPasta]
 */
export async function uploadImagemMidia(empresaId, file, idPasta = null) {
  return uploadImagemMidiaComOrigem(empresaId, file, {
    id_pasta: idPasta,
    origem_upload: "upload_manual",
  });
}

/**
 * @param {File} file
 * @returns {Promise<{ width: number, height: number }>}
 */
export function readImageFileDimensions(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({
        width: img.naturalWidth || 0,
        height: img.naturalHeight || 0,
      });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Não foi possível ler a imagem."));
    };
    img.src = url;
  });
}

/**
 * @param {number} width
 * @param {number} height
 * @returns {string | null} mensagem de erro ou null se ok
 */
export function validateLogoIdentidadeArquivo(width, height) {
  const w = Math.max(0, Math.round(Number(width) || 0));
  const h = Math.max(0, Math.round(Number(height) || 0));
  if (w < 1 || h < 1) return "Não foi possível ler o tamanho da imagem.";
  return null;
}

/**
 * Remove fotos antigas gravadas só para análise (legado). Logo da identidade permanece.
 * @param {string} empresaId
 */
export async function limparFotosAnaliseIdentidade(empresaId) {
  await authApiFetchWithToken(`/empresas/${encodeURIComponent(empresaId)}/identidade/limpar-fotos-analise`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

/**
 * @param {string} empresaId
 */
export async function fetchIdentidadeAnaliseJob(empresaId) {
  const result = await authApiFetchWithToken(`/empresas/${encodeURIComponent(empresaId)}/identidade/analise-job`);
  if (!result.ok || result.networkError) {
    throw new Error(result.networkError?.message || result.json?.error || "Falha ao consultar análise em andamento.");
  }
  return result.json?.job || null;
}

/**
 * @param {string} empresaId
 * @param {{
 *   midia_ids: string[],
 *   inclui_site?: boolean,
 *   site_url?: string,
 *   dados_base?: Record<string, unknown>,
 * }} body
 */
export async function startIdentidadeAnaliseJob(empresaId, body) {
  const result = await authApiFetchWithToken(`/empresas/${encodeURIComponent(empresaId)}/identidade/analise-job`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!result.ok || result.networkError) {
    const err = new Error(
      result.networkError?.message || result.json?.error || "Falha ao iniciar análise em background.",
    );
    err.status = result.status;
    err.job = result.json?.job || null;
    throw err;
  }
  return result.json?.job || null;
}

/**
 * Upload da identidade. A logo fica salva para artes; fotos de análise ficam ocultas e podem ser reusadas por jobs.
 * @param {string} empresaId
 * @param {File} file
 * @param {'logo' | 'foto'} [kind]
 */
export async function uploadImagemIdentidade(empresaId, file, kind = "logo") {
  const origem_upload = kind === "logo" ? "identidade_marca_logo" : "identidade_marca_foto";
  if (kind === "logo") {
    const mime = String(file.type || "").toLowerCase();
    if (!mime.startsWith("image/")) {
      throw new Error("Envie uma imagem (PNG sem fundo é o ideal).");
    }
    const { width, height } = await readImageFileDimensions(file);
    const dimErr = validateLogoIdentidadeArquivo(width, height);
    if (dimErr) throw new Error(dimErr);
  }
  return uploadImagemMidiaComOrigem(empresaId, file, { origem_upload });
}

/**
 * @param {string} empresaId
 * @param {File} file
 * @param {{ id_pasta?: string | null, origem_upload: string }} opts
 */
async function uploadImagemMidiaComOrigem(empresaId, file, opts) {
  const base64_data = await toBase64WithoutPrefix(file);
  const result = await authApiFetchWithToken(`/empresas/${empresaId}/midias/upload-base64`, {
    method: "POST",
    body: JSON.stringify({
      id_pasta: opts.id_pasta ?? null,
      nome_arquivo: file.name,
      nome_exibicao: file.name,
      mime_type: file.type || "image/jpeg",
      tipo_midia: getTipoMidia(file),
      base64_data,
      origem_upload: opts.origem_upload,
    }),
  });
  if (!result.ok || result.networkError) {
    throw new Error(
      result.networkError?.message || result.json?.error || `Falha ao enviar ${file.name}.`,
    );
  }
  const midia = result.json?.midia;
  if (!midia?.id_midia) throw new Error("Upload sem id da mídia.");
  return midia;
}

/**
 * @param {string} empresaId
 */
export async function fetchPastaUploadRaiz(empresaId) {
  const result = await authApiFetchWithToken(`/empresas/${empresaId}/pastas`);
  if (!result.ok || result.networkError) return null;
  return result.json?.id_pasta_upload_raiz || null;
}

/**
 * Logo salva na identidade da marca (não inclui fotos temporárias de análise).
 * @param {string} empresaId
 */
export async function fetchMidiasIdentidade(empresaId) {
  const result = await authApiFetchWithToken(`/empresas/${empresaId}/identidade/midias`);
  if (!result.ok || result.networkError) return [];
  const list = Array.isArray(result.json?.midias) ? result.json.midias : [];
  return list.filter((m) => String(m.tipo_midia || "").toLowerCase() === "imagem");
}
