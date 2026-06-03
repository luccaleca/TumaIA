import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(__dirname, "../../docs/ia/bateria-treino-dialogo-120.csv");

const rows = [];

function esc(v) {
  return `"${String(v ?? "").replace(/"/g, '""')}"`;
}

function push(id, msg, int, cont = "nao", ctx = "", deve = "", nao = "", notas = "") {
  rows.push([id, msg, int, cont, ctx, deve, nao, notas].map(esc).join(","));
}

const saud = ["oi", "olá", "ola", "e aí", "e ai", "bom dia", "boa tarde", "boa noite", "fala", "opa"];
saud.forEach((m, i) => push(i + 1, m, "SAUDACAO", "nao", "", "Tuma", "suplementos|musculação|produtos:", "Cumprimento curto"));

const ident = [
  ["qual seu nome", "Tuma IA"],
  ["como você se chama", "Tuma"],
  ["quem é você", "Tuma"],
  ["vc é quem", "Tuma"],
  ["fala sobre você", "Tuma"],
  ["se apresenta", "Tuma"],
  ["o que você faz", "post|arte|Instagram|Mídias"],
  ["para que você serve", "Tuma"],
  ["quem te criou", "Diego"],
  ["o que significa Tuma", "enviar|suaíli"],
  ["quem tá falando", "Tuma"],
  ["me fala de você", "Tuma"],
];
ident.forEach(([m, d], i) =>
  push(11 + i, m, "IDENTIDADE_TUMA", "nao", "", d, "produtos:|acervo:|whey", "Sem lista de produtos"),
);

const cap = [
  "você consegue me ajudar?",
  "você consegue?",
  "consegue ajudar",
  "vc pode ajudar",
  "se eu pedir uma postagem você ajuda",
  "dá pra fazer arte aqui?",
  "como faço pra pedir um post",
];
cap.forEach((m, i) =>
  push(
    23 + i,
    m,
    "DUVIDA_CAPACIDADE",
    "nao",
    "",
    "Consigo|Ajudo|Escreve",
    "prévia da imagem|confirmar geração",
    "Não abrir arte sozinho",
  ),
);

const como = [
  "como funciona",
  "como funciona o chat",
  "como funciona o tuma",
  "como funciona o painel",
  "para que serve",
];
como.forEach((m, i) =>
  push(30 + i, m, "COMO_FUNCIONA", "nao", "", "chat|painel|resumo|prévia|Mídias", "empresa em sessão|RAG", ""),
);

const prod = [
  "quais produtos temos?",
  "lista o acervo",
  "o que temos em mídias",
  "produtos cadastrados",
  "me lista os produtos",
  "tem o que no acervo",
  "quais itens temos",
];
prod.forEach((m, i) =>
  push(35 + i, m, "LISTAR_PRODUTOS", "nao", "", "", "musculação|hidratação|suplementos de", "Bullets só do acervo real"),
);

const info = [
  ["temos monster?", "monster"],
  ["tem whey?", "whey"],
  ["tem creatina?", "creatina"],
  ["tem produto xyz123?", ""],
  ["quanto custa o whey?", ""],
  ["tem estoque?", ""],
];
info.forEach(([m, d], i) =>
  push(42 + i, m, "INFO_PRODUTO", "nao", "", d, "musculação genérica", "Consultar mídias"),
);

const agrad = ["valeu", "obrigado", "obrigada", "show", "perfeito", "tchau", "até mais", "falou"];
agrad.forEach((m, i) =>
  push(48 + i, m, "AGRADECIMENTO", "nao", "", "chamar|aqui|Perfeito", "produtos:|menu|1.", "Fechamento curto"),
);

const corr = [
  ["não era isso", "Entendi|desculpa"],
  ["entendeu errado", "Entendi"],
  ["para de repetir", "Entendi|direto"],
  ["não era isso só queria seu nome", "Tuma IA"],
  ["já falei", "Entendi"],
  ["não perguntei isso", "Entendi"],
];
corr.forEach(([m, d], i) => push(56 + i, m, "CORRECAO_USUARIO", "nao", "", d, "musculação|lista completa", ""));

push(62, "oi, quem é vc e como funciona?", "COMPOSITO", "nao", "", "Tuma|funciona|painel|Mídias", "suplementos", "Três tópicos");
push(
  63,
  "oi qual seu nome e quais produtos",
  "COMPOSITO",
  "nao",
  "",
  "Tuma",
  "só produtos sem nome",
  "Nome antes ou junto sem ignorar identidade",
);

const cont = [
  [64, "quais produtos temos?", "nao", "", "LISTAR_PRODUTOS", "", "Olá!", ""],
  [
    65,
    "tem monster?",
    "sim",
    "Temos whey de chocolate e Monster no acervo.",
    "INFO_PRODUTO",
    "Monster|não",
    "Olá!|lista inteira de 20",
    "",
  ],
  [66, "valeu", "sim", "Sim, temos Monster.", "AGRADECIMENTO", "", "produtos:", ""],
  [
    67,
    "fala sobre a empresa",
    "sim",
    "Produtos: whey, Monster, creatina.",
    "INFO_EMPRESA",
    "empresa|segmento",
    "repetir lista produtos",
    "",
  ],
  [
    68,
    "qual seu nome",
    "sim",
    "Quer montar post no Instagram?",
    "IDENTIDADE_TUMA",
    "Tuma IA",
    "produtos:|Instagram",
    "",
  ],
  [69, "e os produtos?", "sim", "Meu nome é Tuma IA.", "LISTAR_PRODUTOS", "", "Tuma IA|Olá", ""],
  [
    70,
    "não era isso só queria seu nome",
    "sim",
    "Nossos produtos incluem suplementos de musculação.",
    "CORRECAO_USUARIO",
    "Tuma IA",
    "musculação|produtos:",
    "",
  ],
];
cont.forEach(([id, m, c, ctx, inten, deve, nao, notas]) => push(id, m, inten, c, ctx, deve, nao, notas));

const anti = [
  ["qual seu nome", "IDENTIDADE_TUMA", "Tuma", "whey|monster|produtos"],
  ["quem é você", "IDENTIDADE_TUMA", "Tuma", "suplementos de musculação"],
  ["oi", "SAUDACAO", "Tuma", "planeja post|Instagram com"],
  ["quais produtos", "LISTAR_PRODUTOS", "", "hidratação e recuperação"],
  ["você consegue?", "DUVIDA_CAPACIDADE", "Consigo", "resumo do pedido já está pronto"],
];
let id = 71;
anti.forEach(([m, inten, deve, nao]) => {
  push(id++, m, inten, "nao", "", deve, nao, "Armadilha anti-genérico");
});

const extraIdent = [
  "e aí quem fala",
  "o que é vc",
  "quem é vc",
  "me explica quem é você",
  "fala de voce",
  "apresentação",
  "qual é seu nome",
  "seu nome é o que",
];
extraIdent.forEach((m) => push(id++, m, "IDENTIDADE_TUMA", "nao", "", "Tuma", "produtos:|acervo", ""));

const extraProd = [
  "lista produtos",
  "mostra o acervo",
  "quais mídias temos",
  "o que tem cadastrado",
  "produto disponível",
];
extraProd.forEach((m) =>
  push(id++, m, "LISTAR_PRODUTOS", "nao", "", "", "musculação|genérico", ""),
);

const templates = [
  ["bom dia tudo bem", "SAUDACAO", "Tuma", "produtos"],
  ["como você funciona", "COMO_FUNCIONA", "painel|resumo", "empresa em sessão"],
  ["vc ajuda com post?", "DUVIDA_CAPACIDADE", "Ajudo|post", "gerando prévia agora"],
  ["tem powerade?", "INFO_PRODUTO", "powerade|não encontrei", "musculação"],
  ["obrigado pela ajuda", "AGRADECIMENTO", "", "menu"],
];
while (id <= 120) {
  const t = templates[((id - 91) % templates.length + templates.length) % templates.length];
  push(id++, t[0], t[1], "nao", "", t[2], t[3], "");
}

const header =
  "id,mensagem,intencao,continua_anterior,contexto_assistente_anterior,deve_conter,nao_deve_conter,notas";
fs.writeFileSync(out, `${header}\n${rows.join("\n")}\n`, "utf8");
console.log(`Wrote ${rows.length} rows to ${out}`);
