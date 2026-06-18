import { createEmpresaBody, vincularCriadorComoMembro } from "./shared.js";
import { seedEmpresaModelosPostForNewEmpresa } from "../../services/postModelosService.js";

/** `public.empresa` exige NOT NULL em varchar opcionais — gravamos "" em vez de null. */
export function empresaCampoTextoParaDb(value) {
  if (value === null || value === undefined) return "";
  return String(value);
}

/**
 * @param {import("zod").infer<typeof createEmpresaBody>} b
 */
export function montarRowInsertEmpresa(b) {
  return {
    nome_fantasia: b.nome_fantasia,
    razao_social: empresaCampoTextoParaDb(b.razao_social),
    descricao: empresaCampoTextoParaDb(b.descricao),
    instagram_empresa: empresaCampoTextoParaDb(b.instagram_empresa),
    telefone_principal: empresaCampoTextoParaDb(b.telefone_principal),
    segmento: empresaCampoTextoParaDb(b.segmento),
    cnpj: empresaCampoTextoParaDb(b.cnpj),
    email_principal: empresaCampoTextoParaDb(b.email_principal),
    site_empresa: empresaCampoTextoParaDb(b.site_empresa),
  };
}

/**
 * @param {Partial<import("zod").infer<typeof createEmpresaBody>>} b
 */
export function montarRowPatchEmpresa(b) {
  const row = {};
  if (b.nome_fantasia !== undefined) row.nome_fantasia = b.nome_fantasia;
  if (b.razao_social !== undefined) row.razao_social = empresaCampoTextoParaDb(b.razao_social);
  if (b.descricao !== undefined) row.descricao = empresaCampoTextoParaDb(b.descricao);
  if (b.instagram_empresa !== undefined) row.instagram_empresa = empresaCampoTextoParaDb(b.instagram_empresa);
  if (b.telefone_principal !== undefined) row.telefone_principal = empresaCampoTextoParaDb(b.telefone_principal);
  if (b.segmento !== undefined) row.segmento = empresaCampoTextoParaDb(b.segmento);
  if (b.cnpj !== undefined) row.cnpj = empresaCampoTextoParaDb(b.cnpj);
  if (b.email_principal !== undefined) row.email_principal = empresaCampoTextoParaDb(b.email_principal);
  if (b.site_empresa !== undefined) row.site_empresa = empresaCampoTextoParaDb(b.site_empresa);
  return row;
}

/**
 * Cria empresa e vincula o criador como administrador (POST /empresas/).
 * @returns {Promise<{ ok: true, empresa: object } | { ok: false, status: number, error: unknown }>}
 */
export async function criarEmpresaParaUsuario(supabase, idUsuario, rawBody) {
  const parsed = createEmpresaBody.safeParse(rawBody);
  if (!parsed.success) {
    return { ok: false, status: 400, error: parsed.error.flatten() };
  }

  const row = montarRowInsertEmpresa(parsed.data);

  const { data: emp, error: eEmp } = await supabase
    .from("empresa")
    .insert(row)
    .select("*")
    .single();

  if (eEmp) {
    return { ok: false, status: 500, error: eEmp.message };
  }

  const memb = await vincularCriadorComoMembro(supabase, emp.id_empresa, idUsuario);
  if (!memb.ok) {
    await supabase.from("empresa").delete().eq("id_empresa", emp.id_empresa);
    const msg = memb.error?.message ?? String(memb.error ?? "Erro ao vincular membro");
    return { ok: false, status: 500, error: msg };
  }

  try {
    await seedEmpresaModelosPostForNewEmpresa(supabase, emp.id_empresa);
  } catch (seedErr) {
    console.error("empresa.seedModelosPost:", seedErr);
  }

  return { ok: true, empresa: emp };
}
