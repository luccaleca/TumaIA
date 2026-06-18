/**
 * Verifica empresa_modelo_post no Supabase após os patches SQL.
 * Uso: node scripts/verify-empresa-modelo-post.mjs
 */
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

const EXPECTED_SLUGS = ["promocao", "lancamento", "produto", "mensagens"];
const REQUIRED_COLUMNS = [
  "id_empresa_modelo_post",
  "id_empresa",
  "playbook_slug",
  "ativo",
  "atualizado_por_usuario_id",
  "data_criacao",
  "data_atualizacao",
];

function ok(msg) {
  console.log(`  ✔ ${msg}`);
}
function fail(msg) {
  console.log(`  ✖ ${msg}`);
  return msg;
}
function warn(msg) {
  console.log(`  ⚠ ${msg}`);
}

const { getSupabaseAdmin } = await import("../src/supabaseAdmin.js");
const { mergePostModelosWithEmpresa, loadEmpresaModelosPostRows } = await import(
  "../src/services/postModelosService.js"
);

const db = getSupabaseAdmin();
if (!db) {
  console.error("Supabase indisponível — confira SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no backend/.env");
  process.exit(1);
}

const problems = [];

console.log("\n=== Verificação empresa_modelo_post ===\n");

// 1) Tabela acessível
const probe = await db.from("empresa_modelo_post").select("id_empresa_modelo_post").limit(1);
if (probe.error) {
  fail(`Tabela inacessível: ${probe.error.message}`);
  problems.push(probe.error.message);
  console.log("\nResultado: FALHOU\n");
  process.exit(1);
}
ok("Tabela empresa_modelo_post existe e responde");

// 2) Colunas (amostra)
const sample = await db.from("empresa_modelo_post").select("*").limit(1);
if (sample.error) {
  problems.push(fail(`SELECT * falhou: ${sample.error.message}`));
} else if (sample.data?.[0]) {
  const keys = Object.keys(sample.data[0]);
  for (const col of REQUIRED_COLUMNS) {
    if (keys.includes(col)) ok(`Coluna ${col}`);
    else problems.push(fail(`Coluna ausente: ${col}`));
  }
  for (const key of keys) {
    if (["id_contexto", "id_template", "id_modelo_post"].includes(key)) {
      problems.push(fail(`Coluna legada indevida: ${key}`));
    }
  }
} else {
  warn("Nenhuma linha ainda — colunas serão validadas na estrutura fixa");
}

// 3) Empresas × 4 slugs
const { data: empresas, error: eEmp } = await db.from("empresa").select("id_empresa, nome_fantasia");
if (eEmp) {
  problems.push(fail(`Listar empresas: ${eEmp.message}`));
} else {
  const list = Array.isArray(empresas) ? empresas : [];
  console.log(`\n--- Empresas (${list.length}) ---`);
  if (!list.length) warn("Nenhuma empresa cadastrada");

  const { data: rows, error: eRows } = await db
    .from("empresa_modelo_post")
    .select("id_empresa, playbook_slug, ativo")
    .order("id_empresa")
    .order("playbook_slug");
  if (eRows) {
    problems.push(fail(`Listar modelos: ${eRows.message}`));
  } else {
    const byEmpresa = new Map();
    for (const r of rows || []) {
      const id = String(r.id_empresa);
      if (!byEmpresa.has(id)) byEmpresa.set(id, []);
      byEmpresa.get(id).push(r);
    }

    for (const emp of list) {
      const id = String(emp.id_empresa);
      const modelos = byEmpresa.get(id) || [];
      const slugs = modelos.map((m) => m.playbook_slug).sort();
      const ativos = modelos.filter((m) => m.ativo).map((m) => m.playbook_slug);
      const nome = emp.nome_fantasia || id.slice(0, 8);

      if (modelos.length === 4 && EXPECTED_SLUGS.every((s) => slugs.includes(s))) {
        ok(`${nome}: 4 modelos (${ativos.length} ativo${ativos.length === 1 ? "" : "s"}${ativos.length ? `: ${ativos.join(", ")}` : ""})`);
      } else if (!modelos.length) {
        problems.push(fail(`${nome}: sem linhas — rode patch_empresa_modelo_post_estrutura_fixa.sql`));
      } else {
        const missing = EXPECTED_SLUGS.filter((s) => !slugs.includes(s));
        const extra = slugs.filter((s) => !EXPECTED_SLUGS.includes(s));
        problems.push(
          fail(
            `${nome}: ${modelos.length}/4 modelos` +
              (missing.length ? ` — faltam: ${missing.join(", ")}` : "") +
              (extra.length ? ` — inválidos: ${extra.join(", ")}` : ""),
          ),
        );
      }
    }

    const orphan = (rows || []).filter((r) => !list.some((e) => String(e.id_empresa) === String(r.id_empresa)));
    if (orphan.length) warn(`${orphan.length} linha(s) sem empresa correspondente`);
  }
}

// 4) Serviço (ensure + merge)
console.log("\n--- API / serviço ---");
if (empresas?.[0]?.id_empresa) {
  const idEmp = empresas[0].id_empresa;
  try {
    const loaded = await loadEmpresaModelosPostRows(db, idEmp);
    const merged = mergePostModelosWithEmpresa(loaded);
    if (merged.length === 4) ok(`loadEmpresaModelosPostRows: 4 modelos para empresa teste`);
    else problems.push(fail(`merge retornou ${merged.length} modelos (esperado 4)`));
    const comId = merged.filter((m) => m.id_empresa_modelo_post);
    if (comId.length === 4) ok("Todos os modelos têm id_empresa_modelo_post");
    else problems.push(fail(`Só ${comId.length}/4 modelos com id`));
  } catch (err) {
    problems.push(fail(`Serviço: ${err instanceof Error ? err.message : err}`));
  }
}

// 5) Playbooks legados desativados
const { count: legacyCount, error: eLegacy } = await db
  .from("contexto_empresa")
  .select("id_contexto_empresa", { count: "exact", head: true })
  .eq("ativo", true)
  .filter("dados_json->>playbook", "eq", "true");
if (eLegacy) {
  warn(`Não foi possível checar contexto_empresa legado: ${eLegacy.message}`);
} else if ((legacyCount ?? 0) > 0) {
  problems.push(fail(`${legacyCount} playbook(s) ainda ativo(s) em contexto_empresa`));
} else {
  ok("Nenhum playbook legado ativo em contexto_empresa");
}

console.log("\n=== Resultado ===");
if (problems.length) {
  console.log(`FALHOU — ${problems.length} problema(s):\n`);
  for (const p of problems) console.log(`  • ${p}`);
  process.exit(1);
}
console.log("OK — estrutura fixa de modelos de post está consistente.\n");
process.exit(0);
