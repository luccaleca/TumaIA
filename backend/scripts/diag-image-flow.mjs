/**
 * Diagnóstico local: Supabase + Ollama (proposta) + Replicate (já testado separadamente).
 * Uso: node scripts/diag-image-flow.mjs
 */
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

const { getSupabaseAdmin } = await import("../src/supabaseAdmin.js");
const { generatePostContextProposal } = await import("../src/services/postContextProposalService.js");
const {
  loadContextosEmpresaAtivos,
  loadEmpresaResumoParaImagem,
  loadMidiasEmpresaResumo,
} = await import("../src/services/imagePreviewPrompt.js");

const db = getSupabaseAdmin();
if (!db) {
  console.error("Supabase admin indisponível");
  process.exit(1);
}

const { data: empresas } = await db.from("empresa").select("id_empresa, nome_fantasia").limit(3);
if (!empresas?.length) {
  console.error("Nenhuma empresa no banco");
  process.exit(1);
}

console.log("=== Empresas ===");
for (const e of empresas) console.log("-", e.id_empresa, e.nome_fantasia || "(sem nome)");

const id = empresas[0].id_empresa;
const [empresaRow, contextoRows, midiaRows] = await Promise.all([
  loadEmpresaResumoParaImagem(db, id),
  loadContextosEmpresaAtivos(db, id),
  loadMidiasEmpresaResumo(db, id, 20),
]);
console.log("\n=== Dados painel (empresa 1) ===");
console.log("contextos_ativos:", contextoRows.length);
console.log("midias_ativas:", midiaRows.length);

console.log("\n=== Proposta de contexto (Llama + Supabase) ===");
const t0 = Date.now();
try {
  const out = await generatePostContextProposal({
    history: [{ role: "user", content: "Quero um post no Instagram para o Dia das Mães com foto do acervo" }],
    idEmpresa: id,
    db,
  });
  console.log("OK em", Date.now() - t0, "ms");
  console.log("links:", out.links?.length ?? 0);
  console.log("midias_referenced:", out.post_context_proposal?.midias_referenced?.length ?? 0);
  console.log("confirmação:", String(out.confirmation_message || "").slice(0, 160));
} catch (e) {
  console.log("FALHOU em", Date.now() - t0, "ms —", e instanceof Error ? e.message : e);
  if (e?.parsed) console.log("parsed:", JSON.stringify(e.parsed, null, 2).slice(0, 2000));
  if (e?.zod) console.log("zod:", e.zod);
}
