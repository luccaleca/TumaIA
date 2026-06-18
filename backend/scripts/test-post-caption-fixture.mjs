/**
 * Testa legenda + hashtags sem gerar imagem (Llama + fixture).
 *
 * Uso (na raiz do repo, com backend/.env configurado):
 *   node backend/scripts/test-post-caption-fixture.mjs
 */
import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createMockEmpresaDb } from "../../testes/backend/helpers/mockEmpresaDb.js";
import { generatePostCaption } from "../src/services/postCaptionService.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
config({ path: path.join(root, ".env") });

const ID_EMPRESA = "11111111-1111-4111-8111-111111111111";

const history = [
  {
    role: "user",
    content:
      "promoção de creatina para dia dos namorados, 1 por 99,99 e 2 por 149,99 — usar growth, integral e max",
  },
  { role: "user", content: "pode criar a mensagem, ênfase no dia dos namorados" },
  { role: "assistant", content: "Prévia da imagem gerada." },
];

const post_context_proposal = {
  intent_summary: "Promo Dia dos Namorados — creatinas growth, integral e max",
  resumo_visual: "Arte romântica com três creatinas e tipografia de preço.",
  midias_referenced: [
    { nome_exibicao: "creatina growth" },
    { nome_exibicao: "creatina integral" },
    { nome_exibicao: "creatina max" },
  ],
};

const db = createMockEmpresaDb({
  empresaRow: { nome_fantasia: "Loja Demo" },
  contextoRows: [
    {
      id_empresa: ID_EMPRESA,
      ativo: true,
      nome: "Identidade",
      dados_json: {
        tom_voz: "direto, energético",
        publico: "academias e casais fitness",
      },
    },
  ],
});

const out = await generatePostCaption({
  history,
  idEmpresa: ID_EMPRESA,
  db,
  postContextProposal: post_context_proposal,
});

console.log("\n--- Legenda ---\n");
console.log(out.legenda);
console.log("\n--- Hashtags ---\n");
console.log(out.hashtags.join(" "));
console.log(`\n(modelo: ${out.model})\n`);
