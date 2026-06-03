/**
 * Carrega fatos da sessão (empresa, mídias, contextos) para roteamento e prompt.
 */

import { loadChatAcervoBundle } from "./chatProductGuard.js";
import { loadEmpresaChatFacts } from "./chatEmpresaResponse.js";
import { loadContextosChatFacts } from "./chatContextosResponse.js";

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} db
 * @param {string} idEmpresa
 */
export async function loadChatFacts(db, idEmpresa) {
  const [acervo, empresa, contextos] = await Promise.all([
    loadChatAcervoBundle(db, idEmpresa),
    loadEmpresaChatFacts(db, idEmpresa),
    loadContextosChatFacts(db, idEmpresa),
  ]);

  return {
    acervo,
    empresa,
    contextos: Array.isArray(contextos) ? contextos : [],
    nomeFantasia: acervo.nomeFantasia || String(empresa?.nome_fantasia ?? "").trim() || null,
  };
}
