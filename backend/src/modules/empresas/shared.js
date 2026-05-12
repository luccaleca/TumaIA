import { randomBytes } from "node:crypto";
import path from "node:path";
import { z } from "zod";
import { getSupabaseAdmin } from "../../supabaseAdmin.js";
import { env } from "../../config.js";

export function db() {
  return getSupabaseAdmin();
}

export function gerarCodigoConvite() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const buf = randomBytes(16);
  let s = "";
  for (let i = 0; i < 12; i++) s += chars[buf[i] % chars.length];
  return s;
}

export function normalizarCodigo(raw) {
  return String(raw || "")
    .trim()
    .replace(/\s+/g, "")
    .toUpperCase();
}

export const createEmpresaBody = z.object({
  nome_fantasia: z.string().min(1).max(200),
  razao_social: z.string().max(300).optional().nullable(),
  descricao: z.string().max(4000).optional().nullable(),
  instagram_empresa: z.string().max(200).optional().nullable(),
  telefone_principal: z.string().max(30).optional().nullable(),
  segmento: z.string().max(120).optional().nullable(),
  cnpj: z.string().max(20).optional().nullable(),
  email_principal: z.preprocess(
    (v) => (v === "" || v === undefined ? null : v),
    z.union([z.null(), z.string().email().max(200)]),
  ),
  nome_contato_principal: z.string().max(200).optional().nullable(),
});

export const updateEmpresaBody = createEmpresaBody
  .partial()
  .refine((d) => Object.keys(d).length > 0, {
    message: "Informe ao menos um campo para atualizar",
  });

export const createConviteBody = z.object({
  max_usos: z.number().int().min(1).max(1).optional(),
  expira_em_dias: z.number().int().min(1).max(365).optional().nullable(),
  email_destino: z.string().email().max(255).optional().nullable(),
  cargo: z.enum(["membro", "editor", "administrador"]).optional(),
  perfil_acesso: z.enum(["observador", "editor", "administrador"]).optional(),
  responsavel_operacional: z.boolean().optional(),
  receber_alertas: z.boolean().optional(),
});

export const resgatarBody = z.object({
  codigo: z.string().min(4).max(64),
});

export const membroParam = z.object({
  idEmpresa: z.string().uuid(),
  idUsuario: z.string().uuid(),
});

export const patchMembroBody = z.object({
  cargo: z.enum(["membro", "editor", "administrador"]),
});

export const createPastaBody = z.object({
  nome: z.string().min(1).max(120),
  id_pasta_pai: z.string().uuid().nullable().optional(),
});

export const uploadMidiaBody = z.object({
  id_pasta: z.string().uuid().nullish(),
  nome_arquivo: z.string().min(1).max(260),
  nome_exibicao: z.string().min(1).max(200).optional(),
  tipo_midia: z.enum(["imagem", "video"]),
  mime_type: z.string().min(3).max(120),
  base64_data: z.string().min(10),
  descricao: z.string().max(1000).optional().nullable(),
  alt_text: z.string().max(1000).optional().nullable(),
});

export const midiaParam = z.object({
  idEmpresa: z.string().uuid(),
  idMidia: z.string().uuid(),
});

export const pastaParam = z.object({
  idEmpresa: z.string().uuid(),
  idPasta: z.string().uuid(),
});

export const patchPastaBody = z
  .object({
    id_pasta_pai: z.string().uuid().nullable().optional(),
    nome: z.string().min(1).max(120).optional(),
  })
  .refine((d) => d.id_pasta_pai !== undefined || d.nome !== undefined, {
    message: "Informe id_pasta_pai ou nome",
  });

export const patchMidiaBody = z
  .object({
    id_pasta: z.string().uuid().optional(),
    nome_exibicao: z.string().min(1).max(200).optional(),
  })
  .refine((d) => d.id_pasta !== undefined || d.nome_exibicao !== undefined, {
    message: "Informe id_pasta ou nome_exibicao",
  });

export const contextoParam = z.object({
  idEmpresa: z.string().uuid(),
  idContexto: z.string().uuid(),
});

export const contextoTipoSchema = z.enum([
  "promocao",
  "lancamento",
  "data_comemorativa",
  "personalizado",
]);

export function parseJsonIfString(v) {
  if (typeof v !== "string") return v;
  const txt = v.trim();
  if (!txt) return {};
  try {
    return JSON.parse(txt);
  } catch {
    return v;
  }
}

function textoNormalizado(v, maxLen) {
  if (v == null) return null;
  const txt = String(v).replace(/\r\n/g, "\n").trim();
  if (!txt) return null;
  return txt.slice(0, maxLen);
}

function sanitizeJsonValue(value, depth = 0) {
  if (depth > 8) return null;
  if (value == null) return null;
  if (typeof value === "string") return value.replace(/\r\n/g, "\n").trim();
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) {
    return value
      .map((item) => sanitizeJsonValue(item, depth + 1))
      .filter((item) => item !== undefined);
  }
  if (typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (!k) continue;
      const clean = sanitizeJsonValue(v, depth + 1);
      if (clean !== undefined) out[k] = clean;
    }
    return out;
  }
  return undefined;
}

export function normalizeContextoPayload(input) {
  const tipo = contextoTipoSchema.parse(input?.tipo);
  const nome = textoNormalizado(input?.nome, 200);
  const descricao = textoNormalizado(input?.descricao, 2000) ?? "";
  const dadosBase = parseJsonIfString(input?.dados);
  const dados = sanitizeJsonValue(dadosBase);
  const dadosObj =
    dados && typeof dados === "object" && !Array.isArray(dados) ? dados : { conteudo: dados };
  return {
    tipo,
    nome,
    descricao,
    dados: dadosObj,
  };
}

export const contextoBody = z.object({
  tipo: contextoTipoSchema,
  nome: z.string().max(200).optional().nullable(),
  descricao: z.string().max(2000).optional().nullable(),
  dados: z.preprocess(parseJsonIfString, z.record(z.unknown())),
});

export function perfilAcessoPorCargo(cargo) {
  if (cargo === "administrador") return "administrador";
  return "editor";
}

/**
 * Unifica `cargo` (schema legado) e `papel` (ex.: admin) para o contrato da API.
 * @param {{ cargo?: string | null, papel?: string | null }} row
 * @returns {"administrador" | "editor" | "membro" | null}
 */
export function cargoApiDeUsuarioEmpresa(row) {
  if (!row || typeof row !== "object") return null;
  const c = typeof row.cargo === "string" ? row.cargo.trim().toLowerCase() : "";
  if (c) {
    if (c === "admin" || c === "administrador") return "administrador";
    if (c === "editor") return "editor";
    if (c === "membro" || c === "member") return "membro";
  }
  const p = typeof row.papel === "string" ? row.papel.trim().toLowerCase() : "";
  if (p) {
    if (p === "admin" || p === "administrador") return "administrador";
    if (p === "editor") return "editor";
    if (p === "membro" || p === "member") return "membro";
  }
  return null;
}

export const MEDIA_BUCKET = env.MEDIA_BUCKET || "midias";

export async function vincularCriadorComoMembro(supabase, idEmpresa, idUsuario) {
  const payloadLegacy = {
    id_empresa: idEmpresa,
    id_usuario: idUsuario,
    cargo: "administrador",
    perfil_acesso: "administrador",
    responsavel_operacional: true,
    receber_alertas: true,
    ativo: true,
  };

  const legacyInsert = await supabase.from("usuario_empresa").insert(payloadLegacy);
  if (!legacyInsert.error) return { ok: true };
  return { ok: false, error: legacyInsert.error };
}

export async function getMembroAtivoEmpresa(supabase, idEmpresa, idUsuario) {
  const { data, error } = await supabase
    .from("usuario_empresa")
    .select("id_usuario, cargo, ativo")
    .eq("id_empresa", idEmpresa)
    .eq("id_usuario", idUsuario)
    .eq("ativo", true)
    .maybeSingle();
  if (!data) return { data, error };
  const cargoNormalizado = cargoApiDeUsuarioEmpresa(data);
  return {
    data: {
      ...data,
      cargo: cargoNormalizado,
    },
    error,
  };
}

export function podeGerenciarMidias(cargo) {
  return cargo === "administrador" || cargo === "editor";
}

function slugify(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function nomesTipoAceitos(tipo) {
  if (tipo === "promocao") return ["promocao", "promoção"];
  if (tipo === "lancamento") return ["lancamento", "lançamento"];
  if (tipo === "data_comemorativa") return ["data comemorativa", "data_comemorativa"];
  if (tipo === "personalizado") return ["personalizado"];
  return [tipo];
}

function nomeTipoPadrao(tipo) {
  if (tipo === "promocao") return "Promoção";
  if (tipo === "lancamento") return "Lançamento";
  if (tipo === "data_comemorativa") return "Data Comemorativa";
  if (tipo === "personalizado") return "Personalizado";
  return String(tipo || "Personalizado");
}

export async function resolverTipoETemplate(supabase, tipo) {
  const { data: tipos, error: eTipos } = await supabase
    .from("tipo_contexto")
    .select("id_tipo_contexto, nome")
    .eq("ativo", true);
  if (eTipos) throw new Error(eTipos.message);
  const wanted = new Set(nomesTipoAceitos(tipo).map(slugify));
  let tipoRow = (tipos || []).find((t) => wanted.has(slugify(t.nome)));
  if (!tipoRow) {
    const nomePadrao = nomeTipoPadrao(tipo);
    const { data: createdTipo, error: eInsTipo } = await supabase
      .from("tipo_contexto")
      .insert({
        nome: nomePadrao,
        descricao: `Tipo de contexto: ${nomePadrao}`,
        ativo: true,
      })
      .select("id_tipo_contexto, nome")
      .single();
    if (eInsTipo) {
      const { data: retryTipos, error: eRetryTipos } = await supabase
        .from("tipo_contexto")
        .select("id_tipo_contexto, nome")
        .eq("ativo", true);
      if (eRetryTipos) throw new Error(eRetryTipos.message);
      tipoRow = (retryTipos || []).find((t) => wanted.has(slugify(t.nome)));
      if (!tipoRow) throw new Error(eInsTipo.message);
    } else {
      tipoRow = createdTipo;
    }
  }

  const { data: templates, error: eTpl } = await supabase
    .from("template_contexto")
    .select("id_template")
    .eq("id_tipo_contexto", tipoRow.id_tipo_contexto)
    .eq("ativo", true)
    .limit(1);
  if (eTpl) throw new Error(eTpl.message);
  let idTemplate = templates?.[0]?.id_template;
  if (!idTemplate) {
    const nomePadrao = nomeTipoPadrao(tipo);
    const { data: createdTpl, error: eInsTpl } = await supabase
      .from("template_contexto")
      .insert({
        id_tipo_contexto: tipoRow.id_tipo_contexto,
        nome: "Template padrão",
        descricao: `Template padrão para ${nomePadrao}`,
        schema_json: {
          tipo,
          versao: 1,
        },
        ui_schema_json: {
          layout: "auto",
          tipo,
        },
        prompt_base: `Use o contexto do tipo "${nomePadrao}" para gerar texto de marketing.`,
        ativo: true,
      })
      .select("id_template")
      .single();
    if (eInsTpl) {
      const { data: retryTpl, error: eRetryTpl } = await supabase
        .from("template_contexto")
        .select("id_template")
        .eq("id_tipo_contexto", tipoRow.id_tipo_contexto)
        .eq("ativo", true)
        .limit(1);
      if (eRetryTpl) throw new Error(eRetryTpl.message);
      idTemplate = retryTpl?.[0]?.id_template;
      if (!idTemplate) throw new Error(eInsTpl.message);
    } else {
      idTemplate = createdTpl.id_template;
    }
  }
  return {
    idTipoContexto: tipoRow.id_tipo_contexto,
    nomeTipoContexto: tipoRow.nome,
    idTemplate,
  };
}

export function coletarSubpastas(allPastas, rootId) {
  const descendants = new Set();
  const queue = [rootId];
  while (queue.length) {
    const id = queue.shift();
    for (const row of allPastas) {
      if (row.id_pasta_pai === id && row.id_pasta) {
        descendants.add(row.id_pasta);
        queue.push(row.id_pasta);
      }
    }
  }
  return descendants;
}

export function safeExt(filename) {
  const ext = path.extname(filename || "").toLowerCase().replace(/^\./, "");
  return ext || "bin";
}

export const PASTA_UPLOAD_RAIZ_NOME = "Geral";

export async function getOrCreatePastaUploadRaiz(supabase, idEmpresa) {
  const { data: found, error: eFind } = await supabase
    .from("pasta")
    .select("id_pasta")
    .eq("id_empresa", idEmpresa)
    .is("id_pasta_pai", null)
    .eq("nome", PASTA_UPLOAD_RAIZ_NOME)
    .eq("ativo", true)
    .maybeSingle();
  if (eFind) throw new Error(eFind.message);
  if (found?.id_pasta) return found.id_pasta;

  const { data: created, error: eIns } = await supabase
    .from("pasta")
    .insert({
      id_empresa: idEmpresa,
      id_pasta_pai: null,
      nome: PASTA_UPLOAD_RAIZ_NOME,
      ativo: true,
    })
    .select("id_pasta")
    .single();

  if (eIns) {
    const msg = String(eIns.message || "");
    if (/duplicate|unique/i.test(msg)) {
      const { data: again, error: e2 } = await supabase
        .from("pasta")
        .select("id_pasta")
        .eq("id_empresa", idEmpresa)
        .is("id_pasta_pai", null)
        .eq("nome", PASTA_UPLOAD_RAIZ_NOME)
        .eq("ativo", true)
        .maybeSingle();
      if (e2) throw new Error(e2.message);
      if (again?.id_pasta) return again.id_pasta;
    }
    throw new Error(eIns.message);
  }
  return created.id_pasta;
}
