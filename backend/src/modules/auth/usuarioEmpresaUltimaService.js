import { z } from "zod";
import { getMembroAtivoEmpresa } from "../empresas/shared.js";

export const putEmpresaAtivaBody = z.object({
  id_empresa: z.union([z.string().uuid(), z.null()]),
});

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} db
 * @param {string} idUsuario
 * @param {string | null} idEmpresa
 */
export async function saveUsuarioEmpresaUltima(db, idUsuario, idEmpresa) {
  const idEmp = idEmpresa ? String(idEmpresa).trim() : null;

  if (idEmp) {
    const membro = await getMembroAtivoEmpresa(db, idEmp, idUsuario);
    if (!membro) {
      return {
        ok: false,
        status: 403,
        error: "Você não tem acesso ativo a esta empresa.",
      };
    }
  }

  const { data, error } = await db
    .from("usuario")
    .update({ id_empresa_ultima: idEmp })
    .eq("id_usuario", idUsuario)
    .select("id_usuario, id_empresa_ultima")
    .maybeSingle();

  if (error) {
    return { ok: false, status: 500, error: error.message };
  }
  if (!data) {
    return { ok: false, status: 404, error: "Perfil não encontrado." };
  }

  return { ok: true, id_empresa_ultima: data.id_empresa_ultima ?? null };
}

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} db
 * @param {string} idUsuario
 * @param {string[]} empresaIdsAtivas
 */
export async function resolveIdEmpresaUltimaUsuario(db, idUsuario, empresaIdsAtivas) {
  const ids = new Set((empresaIdsAtivas || []).map(String));
  if (!ids.size) return null;

  const { data, error } = await db
    .from("usuario")
    .select("id_empresa_ultima")
    .eq("id_usuario", idUsuario)
    .maybeSingle();

  if (error) throw new Error(error.message);

  const saved = data?.id_empresa_ultima ? String(data.id_empresa_ultima) : null;
  if (saved && ids.has(saved)) return saved;
  return null;
}
