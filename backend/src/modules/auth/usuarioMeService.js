import { randomUUID } from "node:crypto";

/**
 * Carrega (ou cria fallback) o registro `public.usuario` para GET /auth/me.
 * @param {import("@supabase/supabase-js").SupabaseClient} db
 * @param {string} authUserId
 * @returns {Promise<{ ok: true, usuario: object } | { ok: false, status: number, error: string }>}
 */
export async function loadUsuarioParaMe(db, authUserId) {
  const { data, error } = await db
    .from("usuario")
    .select("*")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (error) {
    return { ok: false, status: 500, error: error.message };
  }

  if (data) {
    return { ok: true, usuario: data };
  }

  const { data: authUserRes, error: authErr } = await db.auth.admin.getUserById(authUserId);
  if (authErr || !authUserRes?.user) {
    return { ok: false, status: 404, error: "Perfil não encontrado para este usuário" };
  }

  const authUser = authUserRes.user;
  const nomeMeta =
    typeof authUser.user_metadata?.nome === "string" ? authUser.user_metadata.nome.trim() : "";
  const emailAuth =
    typeof authUser.email === "string" ? authUser.email.trim().toLowerCase() : "";
  const fallbackNome = nomeMeta || (emailAuth ? emailAuth.split("@")[0] : "Usuário");

  const { data: created, error: createErr } = await db
    .from("usuario")
    .insert({
      id_usuario: randomUUID(),
      auth_user_id: authUserId,
      nome: fallbackNome,
      email: emailAuth || null,
      telefone: null,
      ativo: true,
    })
    .select("*")
    .maybeSingle();

  if (createErr || !created) {
    const msg = String(createErr?.message || "");
    if (/duplicate|unique/i.test(msg)) {
      const { data: retried, error: retryErr } = await db
        .from("usuario")
        .select("*")
        .eq("auth_user_id", authUserId)
        .maybeSingle();
      if (retryErr || !retried) {
        return {
          ok: false,
          status: 500,
          error: retryErr?.message || "Falha ao recuperar perfil",
        };
      }
      return { ok: true, usuario: retried };
    }
    return {
      ok: false,
      status: 500,
      error: createErr?.message || "Falha ao criar perfil",
    };
  }

  return { ok: true, usuario: created };
}
