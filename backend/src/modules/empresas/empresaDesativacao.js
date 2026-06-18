import { cargoApiDeUsuarioEmpresa } from "./shared.js";

function normalizarNomeConfirmacao(nome) {
  return String(nome || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {string} idEmpresa
 */
async function countAdminsAtivos(supabase, idEmpresa) {
  const { data, error } = await supabase
    .from("usuario_empresa")
    .select("id_usuario, cargo, perfil_acesso")
    .eq("id_empresa", idEmpresa)
    .eq("ativo", true);
  if (error) throw new Error(error.message);
  return (data || []).filter((m) => cargoApiDeUsuarioEmpresa(m) === "administrador").length;
}

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {string} idEmpresa
 */
async function countMembrosAtivos(supabase, idEmpresa) {
  const { count, error } = await supabase
    .from("usuario_empresa")
    .select("id_usuario", { count: "exact", head: true })
    .eq("id_empresa", idEmpresa)
    .eq("ativo", true);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

/**
 * Usuário remove apenas o próprio vínculo com a empresa.
 *
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {string} idEmpresa
 * @param {string} idUsuario
 */
export async function sairDaEmpresa(supabase, idEmpresa, idUsuario) {
  const { data: empresa, error: eEmp } = await supabase
    .from("empresa")
    .select("id_empresa, nome_fantasia, ativo")
    .eq("id_empresa", idEmpresa)
    .maybeSingle();
  if (eEmp) throw new Error(eEmp.message);
  if (!empresa || empresa.ativo === false) {
    return { ok: false, status: 404, error: "Empresa não encontrada ou já desativada." };
  }

  const { data: membro, error: eMem } = await supabase
    .from("usuario_empresa")
    .select("id_usuario, cargo, perfil_acesso, ativo")
    .eq("id_empresa", idEmpresa)
    .eq("id_usuario", idUsuario)
    .eq("ativo", true)
    .maybeSingle();
  if (eMem) throw new Error(eMem.message);
  if (!membro) {
    return { ok: false, status: 403, error: "Você não está vinculado a esta empresa." };
  }

  const cargo = cargoApiDeUsuarioEmpresa(membro);
  const admins = await countAdminsAtivos(supabase, idEmpresa);
  const membros = await countMembrosAtivos(supabase, idEmpresa);

  if (cargo === "administrador" && admins <= 1 && membros > 1) {
    return {
      ok: false,
      status: 409,
      error:
        "Você é o único administrador. Promova outro membro a administrador antes de sair, ou desative a empresa.",
    };
  }

  const { error: eUp } = await supabase
    .from("usuario_empresa")
    .update({ ativo: false })
    .eq("id_empresa", idEmpresa)
    .eq("id_usuario", idUsuario)
    .eq("ativo", true);
  if (eUp) throw new Error(eUp.message);

  return {
    ok: true,
    saiu: true,
    nome_fantasia: empresa.nome_fantasia,
  };
}

/**
 * Administrador desativa a empresa (soft delete) e vínculos ativos.
 *
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {string} idEmpresa
 * @param {string} idUsuario
 * @param {string} confirmacaoNome
 */
export async function desativarEmpresa(supabase, idEmpresa, idUsuario, confirmacaoNome) {
  const { data: empresa, error: eEmp } = await supabase
    .from("empresa")
    .select("id_empresa, nome_fantasia, ativo")
    .eq("id_empresa", idEmpresa)
    .maybeSingle();
  if (eEmp) throw new Error(eEmp.message);
  if (!empresa) {
    return { ok: false, status: 404, error: "Empresa não encontrada." };
  }
  if (empresa.ativo === false) {
    return { ok: false, status: 409, error: "Esta empresa já está desativada." };
  }

  const { data: membro, error: eMem } = await supabase
    .from("usuario_empresa")
    .select("cargo, perfil_acesso, ativo")
    .eq("id_empresa", idEmpresa)
    .eq("id_usuario", idUsuario)
    .eq("ativo", true)
    .maybeSingle();
  if (eMem) throw new Error(eMem.message);
  if (!membro || cargoApiDeUsuarioEmpresa(membro) !== "administrador") {
    return {
      ok: false,
      status: 403,
      error: "Somente administradores podem desativar a empresa.",
    };
  }

  const esperado = normalizarNomeConfirmacao(empresa.nome_fantasia);
  const informado = normalizarNomeConfirmacao(confirmacaoNome);
  if (!informado || informado !== esperado) {
    return {
      ok: false,
      status: 400,
      error: `Digite exatamente o nome fantasia da empresa para confirmar: ${empresa.nome_fantasia}`,
    };
  }

  const { error: eEmpresa } = await supabase
    .from("empresa")
    .update({ ativo: false })
    .eq("id_empresa", idEmpresa);
  if (eEmpresa) throw new Error(eEmpresa.message);

  const { error: eVinculos } = await supabase
    .from("usuario_empresa")
    .update({ ativo: false })
    .eq("id_empresa", idEmpresa)
    .eq("ativo", true);
  if (eVinculos) throw new Error(eVinculos.message);

  await supabase.from("contexto_empresa").update({ ativo: false }).eq("id_empresa", idEmpresa).eq("ativo", true);
  await supabase.from("empresa_modelo_post").update({ ativo: false }).eq("id_empresa", idEmpresa).eq("ativo", true);
  await supabase.from("midia").update({ ativo: false }).eq("id_empresa", idEmpresa).eq("ativo", true);
  await supabase.from("pasta").update({ ativo: false }).eq("id_empresa", idEmpresa).eq("ativo", true);

  return {
    ok: true,
    desativada: true,
    id_empresa: idEmpresa,
    nome_fantasia: empresa.nome_fantasia,
  };
}
