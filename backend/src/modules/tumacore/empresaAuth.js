import { cargoApiDeUsuarioEmpresa } from "../empresas/shared.js";

/**
 * Escolhe a empresa autorizada entre vínculos de administrador ativos.
 * Prefere `id_empresa_ultima` se estiver na lista; senão a primeira (ordem estável).
 * Nunca usa id enviado pelo cliente.
 *
 * @param {Array<{ id_empresa: string, nome_fantasia?: string }>} empresasAdmin
 * @param {string | null | undefined} idEmpresaUltima
 */
export function pickIdEmpresaAutorizada(empresasAdmin, idEmpresaUltima) {
  const list = (empresasAdmin || [])
    .filter((e) => e?.id_empresa)
    .map((e) => ({
      id_empresa: String(e.id_empresa),
      nome_fantasia: String(e.nome_fantasia || "").trim() || "Empresa",
      ativo: e.ativo !== false,
    }))
    .filter((e) => e.ativo)
    .sort((a, b) => a.id_empresa.localeCompare(b.id_empresa));

  if (!list.length) return null;

  const ultima = idEmpresaUltima ? String(idEmpresaUltima).trim() : "";
  if (ultima) {
    const hit = list.find((e) => e.id_empresa === ultima);
    if (hit) return hit;
  }
  return list[0];
}

/**
 * Resolve a empresa do TumaCore Empresa a partir do usuário autenticado.
 * Ignora qualquer id_empresa vindo de query/body/params.
 *
 * @param {import("@supabase/supabase-js").SupabaseClient} db
 * @param {Record<string, unknown>} usuario
 */
export async function resolveTumaCoreEmpresaAutorizada(db, usuario) {
  const idUsuario = usuario?.id_usuario ? String(usuario.id_usuario) : "";
  if (!idUsuario) {
    return { ok: false, status: 403, error: "Usuário sem perfil válido." };
  }

  const { data: membros, error: eMembros } = await db
    .from("usuario_empresa")
    .select("id_empresa, cargo, perfil_acesso, ativo")
    .eq("id_usuario", idUsuario)
    .eq("ativo", true);

  if (eMembros) {
    return { ok: false, status: 500, error: eMembros.message };
  }

  const adminIds = [
    ...new Set(
      (membros || [])
        .filter((m) => cargoApiDeUsuarioEmpresa(m) === "administrador")
        .map((m) => String(m.id_empresa || ""))
        .filter(Boolean),
    ),
  ];

  if (!adminIds.length) {
    return {
      ok: false,
      status: 403,
      error: "Acesso restrito a administradores da empresa (TumaCore Empresa).",
    };
  }

  const { data: empresas, error: eEmp } = await db
    .from("empresa")
    .select("id_empresa, nome_fantasia, segmento, ativo")
    .in("id_empresa", adminIds);

  if (eEmp) {
    return { ok: false, status: 500, error: eEmp.message };
  }

  const escolhida = pickIdEmpresaAutorizada(
    empresas || [],
    usuario.id_empresa_ultima,
  );

  if (!escolhida) {
    return {
      ok: false,
      status: 403,
      error: "Nenhuma empresa ativa vinculada como administrador.",
    };
  }

  return {
    ok: true,
    id_empresa: escolhida.id_empresa,
    empresa: escolhida,
    cargo: "administrador",
  };
}
