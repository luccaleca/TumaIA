import {
  POST_MODELO_SLUGS,
  POST_MODELOS_CATALOG,
  buildPlaybookDadosJson,
  getPostModeloBySlug,
  isPostModeloSlug,
} from "../modules/empresas/postModelosCatalog.js";

const EMPRESA_MODELO_POST_SELECT =
  "id_empresa_modelo_post, id_empresa, playbook_slug, ativo, data_criacao, data_atualizacao";

/**
 * Linha `empresa_modelo_post` → formato compatível com `contexto_empresa` (chat / imagem).
 *
 * @param {Record<string, unknown>} empresaModeloRow
 * @returns {Record<string, unknown> | null}
 */
export function buildPlaybookContextoRow(empresaModeloRow) {
  if (!empresaModeloRow || typeof empresaModeloRow !== "object") return null;
  if (empresaModeloRow.ativo !== true) return null;
  const slug = String(empresaModeloRow.playbook_slug ?? "").trim();
  const modelo = getPostModeloBySlug(slug);
  if (!modelo) return null;
  const id = String(empresaModeloRow.id_empresa_modelo_post ?? "").trim();
  if (!id) return null;
  return {
    id_contexto_empresa: id,
    id_empresa_modelo_post: id,
    nome: modelo.nome,
    descricao: modelo.tagline,
    schema_json: { tipo: modelo.tipo, versao: 2, playbook_slug: modelo.slug },
    dados_json: buildPlaybookDadosJson(modelo),
    data_criacao: empresaModeloRow.data_criacao ?? null,
  };
}

/**
 * @param {Array<Record<string, unknown>>} modeloRows
 */
export function mergePostModelosWithEmpresa(modeloRows) {
  const rows = Array.isArray(modeloRows) ? modeloRows : [];
  const bySlug = new Map();
  for (const row of rows) {
    const slug = String(row.playbook_slug ?? "").trim();
    if (slug && isPostModeloSlug(slug) && !bySlug.has(slug)) bySlug.set(slug, row);
  }

  return POST_MODELOS_CATALOG.map((modelo) => {
    const row = bySlug.get(modelo.slug);
    const ativo = row?.ativo === true;
    const id = row ? String(row.id_empresa_modelo_post ?? "").trim() || null : null;
    return {
      slug: modelo.slug,
      tipo: modelo.tipo,
      nome: modelo.nome,
      tagline: modelo.tagline,
      descricao: modelo.descricao || "",
      quando_usar: modelo.quando_usar || [],
      diferencial: modelo.diferencial || [],
      exemplo_imagem_url: modelo.exemploImagemUrl,
      enfase: modelo.enfase,
      estrutura: modelo.estrutura,
      ativo,
      id_empresa_modelo_post: id,
      /** @deprecated use id_empresa_modelo_post — alias para o chat legado */
      id_contexto_empresa: id,
    };
  });
}

/**
 * Garante as 4 linhas fixas por empresa (todas com registro; `ativo` é o único campo editável).
 *
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {string} idEmpresa
 */
export async function ensureEmpresaModelosPostStructure(supabase, idEmpresa) {
  const missing = [];
  const { data: existing, error: eLoad } = await supabase
    .from("empresa_modelo_post")
    .select("playbook_slug")
    .eq("id_empresa", idEmpresa);
  if (eLoad) throw new Error(eLoad.message);
  const have = new Set(
    (Array.isArray(existing) ? existing : []).map((r) => String(r.playbook_slug ?? "").trim()),
  );
  for (const slug of POST_MODELO_SLUGS) {
    if (!have.has(slug)) missing.push({ id_empresa: idEmpresa, playbook_slug: slug, ativo: false });
  }
  if (!missing.length) return;
  const { error: eInsert } = await supabase.from("empresa_modelo_post").insert(missing);
  if (eInsert) throw new Error(eInsert.message);
}

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {string} idEmpresa
 */
export async function loadEmpresaModelosPostRows(supabase, idEmpresa) {
  await ensureEmpresaModelosPostStructure(supabase, idEmpresa);
  const { data, error } = await supabase
    .from("empresa_modelo_post")
    .select(EMPRESA_MODELO_POST_SELECT)
    .eq("id_empresa", idEmpresa)
    .order("playbook_slug", { ascending: true });
  if (error) throw new Error(error.message);
  return Array.isArray(data) ? data : [];
}

/**
 * Modelos ativos no formato esperado pelo chat e pela geração de imagem.
 *
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {string} idEmpresa
 */
export async function loadActiveModeloContextoRowsForEmpresa(supabase, idEmpresa) {
  await ensureEmpresaModelosPostStructure(supabase, idEmpresa);
  const { data, error } = await supabase
    .from("empresa_modelo_post")
    .select(EMPRESA_MODELO_POST_SELECT)
    .eq("id_empresa", idEmpresa)
    .eq("ativo", true)
    .order("playbook_slug", { ascending: true });
  if (error) throw new Error(error.message);
  const rows = Array.isArray(data) ? data : [];
  return rows.map(buildPlaybookContextoRow).filter(Boolean);
}

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {string} idEmpresa
 * @param {string} idUsuario
 * @param {string} slug
 * @param {boolean} ativo
 */
export async function setPostModeloAtivoForEmpresa(supabase, idEmpresa, idUsuario, slug, ativo) {
  const modelo = getPostModeloBySlug(slug);
  if (!modelo) {
    const err = new Error("Modelo de post não encontrado.");
    err.status = 404;
    throw err;
  }

  await ensureEmpresaModelosPostStructure(supabase, idEmpresa);

  const { data: existing, error: eLoad } = await supabase
    .from("empresa_modelo_post")
    .select("id_empresa_modelo_post, ativo")
    .eq("id_empresa", idEmpresa)
    .eq("playbook_slug", slug)
    .maybeSingle();
  if (eLoad) throw new Error(eLoad.message);
  if (!existing?.id_empresa_modelo_post) {
    throw new Error("Estrutura de modelos da empresa incompleta — tente novamente.");
  }

  const { data: updated, error } = await supabase
    .from("empresa_modelo_post")
    .update({
      ativo,
      atualizado_por_usuario_id: idUsuario,
    })
    .eq("id_empresa_modelo_post", existing.id_empresa_modelo_post)
    .eq("id_empresa", idEmpresa)
    .select("id_empresa_modelo_post, ativo")
    .maybeSingle();
  if (error) throw new Error(error.message);

  const id = updated?.id_empresa_modelo_post ?? existing.id_empresa_modelo_post;
  return modeloPatchResult(slug, Boolean(updated?.ativo), id);
}

/**
 * Chamado ao criar empresa — redundante com trigger SQL, mas garante em ambientes sem trigger.
 *
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {string} idEmpresa
 */
export async function seedEmpresaModelosPostForNewEmpresa(supabase, idEmpresa) {
  await ensureEmpresaModelosPostStructure(supabase, idEmpresa);
}

/**
 * @param {string} slug
 * @param {boolean} ativo
 * @param {string | null | undefined} id
 */
function modeloPatchResult(slug, ativo, id) {
  const idModelo = id ? String(id) : null;
  return {
    slug,
    ativo,
    id_empresa_modelo_post: idModelo,
    id_contexto_empresa: idModelo,
  };
}
