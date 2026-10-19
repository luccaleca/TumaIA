import { getMembroAtivoEmpresa } from "./shared.js";
import { resolveIdEmpresaUltimaUsuario } from "../auth/usuarioEmpresaUltimaService.js";

const STATUS_VIGENTES = new Set(["ativa", "ativo", "active", "trial", "teste"]);

function assinaturaVigente(assinatura, agora) {
  const status = String(assinatura?.status ?? "")
    .trim()
    .toLowerCase();
  if (!STATUS_VIGENTES.has(status)) return false;
  const fim = assinatura?.data_fim ? Date.parse(assinatura.data_fim) : NaN;
  return Number.isNaN(fim) || fim >= agora.getTime();
}

/**
 * Plano da empresa ativa do usuário. A empresa vem do pedido (se o usuário for membro) ou da
 * «última empresa» salva no perfil. Sem assinatura ou sem as tabelas, devolve `plano: null`.
 *
 * @param {import("@supabase/supabase-js").SupabaseClient} db
 * @param {{ idUsuario: string, idEmpresaPreferida?: string | null, agora?: Date }} opts
 */
export async function buscarPlanoAtual(db, { idUsuario, idEmpresaPreferida = null, agora = new Date() }) {
  const { data: membros, error: eMembros } = await db
    .from("usuario_empresa")
    .select("id_empresa")
    .eq("id_usuario", idUsuario)
    .eq("ativo", true);
  if (eMembros) throw new Error(eMembros.message);

  const ids = [...new Set((membros || []).map((m) => String(m.id_empresa || "")).filter(Boolean))];
  if (!ids.length) return { id_empresa: null, plano: null };

  let idEmpresa = null;
  const preferida = idEmpresaPreferida ? String(idEmpresaPreferida).trim() : "";
  if (preferida && ids.includes(preferida)) {
    const membro = await getMembroAtivoEmpresa(db, preferida, idUsuario);
    if (membro) idEmpresa = preferida;
  }
  if (!idEmpresa) {
    idEmpresa = (await resolveIdEmpresaUltimaUsuario(db, idUsuario, ids)) || ids[0];
  }

  const { data: assinaturas, error: eAssin } = await db
    .from("assinatura_empresa")
    .select("id_assinatura, id_plano, status, data_inicio, data_fim")
    .eq("id_empresa", idEmpresa)
    .order("data_fim", { ascending: false });
  if (eAssin) {
    console.warn("planoAtual assinatura_empresa:", eAssin.message);
    return { id_empresa: idEmpresa, plano: null };
  }

  const lista = assinaturas || [];
  const assinatura = lista.find((a) => assinaturaVigente(a, agora)) || lista[0];
  if (!assinatura) return { id_empresa: idEmpresa, plano: null };

  const { data: plano, error: ePlano } = await db
    .from("plano")
    .select("id_plano, nome, descricao, valor_mensal, limite_posts_mes, limite_contas, limite_usuarios")
    .eq("id_plano", assinatura.id_plano)
    .maybeSingle();
  if (ePlano || !plano) {
    if (ePlano) console.warn("planoAtual plano:", ePlano.message);
    return { id_empresa: idEmpresa, plano: null };
  }

  return {
    id_empresa: idEmpresa,
    plano: {
      id_plano: plano.id_plano,
      nome: plano.nome,
      descricao: plano.descricao,
      valor_mensal: plano.valor_mensal,
      limite_posts_mes: plano.limite_posts_mes,
      limite_contas: plano.limite_contas,
      limite_usuarios: plano.limite_usuarios,
      status: assinatura.status,
      vigente: assinaturaVigente(assinatura, agora),
      data_fim: assinatura.data_fim,
    },
  };
}
