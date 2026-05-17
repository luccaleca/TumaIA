import { authApiFetchWithToken } from "./auth";

export const MAX_FOTOS_IDENTIDADE = 8;

export const emptyDados = {
  sobre_empresa: "",
  segmento: "",
  tom_voz: "",
  estilo_visual: "",
  evitar: "",
  publico: "",
  cor_primaria: "#6B2D9E",
  cor_secundaria: "#D4AF37",
  exemplo_frase_marca: "",
  site_url: "",
  id_midia_referencia_analise: null,
  legenda_referencia: "",
};

/** Campos usados na barra de progresso (espelha o backend). */
export const PILARES_COMPLETUDE = [
  { key: "cor_primaria", label: "Cores" },
  { key: "tom_voz", label: "Tom de voz" },
  { key: "estilo_visual", label: "Estilo visual" },
  { key: "sobre_empresa", label: "Sobre a empresa" },
];

const MERGE_KEYS = [
  "sobre_empresa",
  "segmento",
  "tom_voz",
  "estilo_visual",
  "evitar",
  "publico",
  "cor_primaria",
  "cor_secundaria",
  "exemplo_frase_marca",
];

export function dadosFromApi(raw) {
  if (!raw || typeof raw !== "object") return { ...emptyDados };
  return {
    sobre_empresa: raw.sobre_empresa || "",
    segmento: raw.segmento || "",
    tom_voz: raw.tom_voz || "",
    estilo_visual: raw.estilo_visual || "",
    evitar: raw.evitar || "",
    publico: raw.publico || "",
    cor_primaria: raw.cor_primaria || "#6B2D9E",
    cor_secundaria: raw.cor_secundaria || "#D4AF37",
    exemplo_frase_marca: raw.exemplo_frase_marca || "",
    site_url: raw.site_url || "",
    id_midia_referencia_analise: raw.id_midia_referencia_analise || null,
    legenda_referencia: raw.legenda_referencia || "",
  };
}

/**
 * @param {Record<string, string>} dados
 */
/** Há conteúdo de identidade já salvo ou analisado (não só cores padrão vazias). */
export function temConteudoIdentidade(dados) {
  if (!dados || typeof dados !== "object") return false;
  return Boolean(
    String(dados.sobre_empresa ?? "").trim() ||
      String(dados.tom_voz ?? "").trim() ||
      String(dados.estilo_visual ?? "").trim() ||
      String(dados.segmento ?? "").trim() ||
      String(dados.publico ?? "").trim() ||
      String(dados.evitar ?? "").trim() ||
      String(dados.exemplo_frase_marca ?? "").trim(),
  );
}

export function calcCompletudeLocal(dados) {
  const checks = PILARES_COMPLETUDE.map(({ key }) => ({
    key,
    ok: Boolean(String(dados[key] ?? "").trim()),
  }));
  const done = checks.filter((c) => c.ok).length;
  return {
    percentual: Math.round((done / checks.length) * 100),
    pronto_para_imagem: done >= 2 && Boolean(dados.cor_primaria?.trim()),
    faltando: checks.filter((c) => !c.ok).map((c) => c.key),
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
    const cur = String(out[key] ?? "").trim();
    if (!cur) out[key] = String(next).trim();
  }
  return out;
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
export async function uploadImagemMidia(empresaId, file, idPasta = null) {
  const base64_data = await toBase64WithoutPrefix(file);
  const result = await authApiFetchWithToken(`/empresas/${empresaId}/midias/upload-base64`, {
    method: "POST",
    body: JSON.stringify({
      id_pasta: idPasta,
      nome_arquivo: file.name,
      nome_exibicao: file.name,
      mime_type: file.type || "image/jpeg",
      tipo_midia: getTipoMidia(file),
      base64_data,
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
