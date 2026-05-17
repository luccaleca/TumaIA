import { createEmpresaBody, vincularCriadorComoMembro } from "./shared.js";

/**
 * Cria empresa e vincula o criador como administrador (POST /empresas/).
 * @returns {Promise<{ ok: true, empresa: object } | { ok: false, status: number, error: unknown }>}
 */
export async function criarEmpresaParaUsuario(supabase, idUsuario, rawBody) {
  const parsed = createEmpresaBody.safeParse(rawBody);
  if (!parsed.success) {
    return { ok: false, status: 400, error: parsed.error.flatten() };
  }

  const b = parsed.data;
  const row = {
    nome_fantasia: b.nome_fantasia,
    razao_social: b.razao_social ?? null,
    descricao: b.descricao ?? null,
    instagram_empresa: b.instagram_empresa ?? null,
    telefone_principal: b.telefone_principal ?? null,
    segmento: b.segmento ?? null,
    cnpj: b.cnpj ?? null,
    email_principal: b.email_principal ?? null,
  };

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

  return { ok: true, empresa: emp };
}
