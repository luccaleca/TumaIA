/**
 * Cadastra um usuário de teste em POST /auth/register.
 * Uso: com o servidor rodando (`npm run dev`), em outro terminal:
 *   npm run test:register
 *
 * E-mail é único a cada execução para não dar conflito no Supabase.
 */
const port = process.env.PORT || 4000;
const base = `http://127.0.0.1:${port}`;

const body = {
  nome: "Usuario Teste",
  email: `teste-${Date.now()}@tumaia.local`,
  senha: "senhaSegura1",
  telefone: "11999999999",
};

const res = await fetch(`${base}/auth/register`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

const text = await res.text();
let json;
try {
  json = JSON.parse(text);
} catch {
  json = text;
}

console.log("Status:", res.status);
console.log("Resposta:", JSON.stringify(json, null, 2));

if (!res.ok) {
  process.exit(1);
}
