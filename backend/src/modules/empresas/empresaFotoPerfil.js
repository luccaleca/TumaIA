import { MEDIA_BUCKET } from "./shared.js";

const MAX_BYTES = 3 * 1024 * 1024;
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

function extFromMime(mime) {
  const m = String(mime || "").toLowerCase();
  if (m === "image/jpeg") return "jpg";
  if (m === "image/png") return "png";
  if (m === "image/webp") return "webp";
  return "jpg";
}

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {string} idEmpresa
 * @param {Buffer} buffer
 * @param {string} mimeType
 */
export async function aplicarFotoPerfilEmpresa(supabase, idEmpresa, buffer, mimeType) {
  const mime = String(mimeType || "").trim().toLowerCase();
  if (!ALLOWED_MIME.has(mime)) {
    throw new Error("Formato inválido. Use JPEG, PNG ou WebP.");
  }
  if (!buffer.length || buffer.length > MAX_BYTES) {
    throw new Error("Imagem muito grande (máx. 3 MB).");
  }

  const { data: antes, error: e0 } = await supabase
    .from("empresa")
    .select("foto_perfil_caminho")
    .eq("id_empresa", idEmpresa)
    .maybeSingle();
  if (e0) throw new Error(e0.message);

  const oldPath = antes?.foto_perfil_caminho ? String(antes.foto_perfil_caminho).trim() : "";
  const ext = extFromMime(mime);
  const caminho = `${idEmpresa}/_perfil/logo-${Date.now()}.${ext}`;

  const { error: eUp } = await supabase.storage.from(MEDIA_BUCKET).upload(caminho, buffer, {
    contentType: mime,
    upsert: true,
  });
  if (eUp) throw new Error(`Falha no storage: ${eUp.message}`);

  const publicUrl =
    supabase.storage.from(MEDIA_BUCKET).getPublicUrl(caminho)?.data?.publicUrl ?? null;

  try {
    const { data: updated, error: e2 } = await supabase
      .from("empresa")
      .update({
        foto_perfil_caminho: caminho,
        foto_perfil_url: publicUrl,
      })
      .eq("id_empresa", idEmpresa)
      .select("*")
      .single();
    if (e2) throw new Error(e2.message);
    if (oldPath && oldPath !== caminho) {
      await supabase.storage.from(MEDIA_BUCKET).remove([oldPath]).catch(() => {});
    }
    return updated;
  } catch (err) {
    await supabase.storage.from(MEDIA_BUCKET).remove([caminho]).catch(() => {});
    throw err;
  }
}

/**
 * Espelha a logo da identidade (`id_midia_logo`) em `empresa.foto_perfil_url`
 * para cards/lista do painel. Não grava caminho próprio — a midia é a fonte.
 *
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {string} idEmpresa
 * @param {string | null | undefined} idMidiaLogo
 */
export async function syncEmpresaFotoPerfilFromLogoMidia(supabase, idEmpresa, idMidiaLogo) {
  const logoId = String(idMidiaLogo || "").trim();

  const { data: antes, error: e0 } = await supabase
    .from("empresa")
    .select("foto_perfil_caminho")
    .eq("id_empresa", idEmpresa)
    .maybeSingle();
  if (e0) throw new Error(e0.message);

  const oldPath = antes?.foto_perfil_caminho ? String(antes.foto_perfil_caminho).trim() : "";
  const orphanPerfil =
    oldPath && (oldPath.includes("/_perfil/") || oldPath.startsWith(`${idEmpresa}/_perfil/`))
      ? oldPath
      : "";

  let fotoUrl = null;
  if (logoId) {
    const { data: midia, error: eM } = await supabase
      .from("midia")
      .select("id_midia, id_empresa, ativo, url_arquivo")
      .eq("id_midia", logoId)
      .maybeSingle();
    if (eM) throw new Error(eM.message);
    if (midia && String(midia.id_empresa) === String(idEmpresa) && midia.ativo !== false) {
      const url = midia.url_arquivo ? String(midia.url_arquivo).trim() : "";
      fotoUrl = url || null;
    }
  }

  const { error: e1 } = await supabase
    .from("empresa")
    .update({
      foto_perfil_url: fotoUrl,
      foto_perfil_caminho: null,
    })
    .eq("id_empresa", idEmpresa);
  if (e1) throw new Error(e1.message);

  if (orphanPerfil) {
    await supabase.storage.from(MEDIA_BUCKET).remove([orphanPerfil]).catch(() => {});
  }
}

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {string} idEmpresa
 */
export async function removerFotoPerfilEmpresa(supabase, idEmpresa) {
  const { data: emp, error: e0 } = await supabase
    .from("empresa")
    .select("foto_perfil_caminho")
    .eq("id_empresa", idEmpresa)
    .maybeSingle();
  if (e0) throw new Error(e0.message);
  const path = emp?.foto_perfil_caminho ? String(emp.foto_perfil_caminho).trim() : "";

  const { data: updated, error: e1 } = await supabase
    .from("empresa")
    .update({
      foto_perfil_caminho: null,
      foto_perfil_url: null,
    })
    .eq("id_empresa", idEmpresa)
    .select("*")
    .single();
  if (e1) throw new Error(e1.message);

  if (path) {
    await supabase.storage.from(MEDIA_BUCKET).remove([path]).catch(() => {});
  }
  return updated;
}
