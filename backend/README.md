# TumaIA Backend (Node + Express)

## O que é

API interna para o N8N (e depois o painel Next.js) acessar:

- contexto de marca no Supabase
- geração de texto no Gemini

As rotas em `/internal/*` são protegidas por `INTERNAL_WEBHOOK_SECRET`.

## Setup rápido

1) Copie o arquivo de exemplo:

- `backend/.env.example` → `backend/.env`

2) Preencha:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (use no backend; **nunca** no browser)
- `INTERNAL_WEBHOOK_SECRET`
- `GOOGLE_AI_API_KEY` (opcional por enquanto)

3) Instale e rode:

```bash
cd backend
npm install
npm run dev
```

Servidor padrão: `http://localhost:4000`

## Cadastro (site → Auth + `public.usuarios`)

`POST /auth/register` cria o usuário no **Supabase Auth** (API admin) e insere a linha em **`public.usuarios`** (`id_usuario` gerado no servidor, `auth_user_id` = `auth.users.id`).

Corpo JSON:

- `nome` (obrigatório)
- `email` (obrigatório)
- `senha` (obrigatório, mínimo 8 caracteres)
- `telefone` (opcional)

Variáveis: `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` no `backend/.env`.

```bash
curl -X POST http://localhost:4000/auth/register ^
  -H "Content-Type: application/json" ^
  -d "{\"nome\":\"Maria Silva\",\"email\":\"maria@exemplo.com\",\"senha\":\"senhaSegura1\",\"telefone\":\"11999999999\"}"
```

Resposta `201`: `id_usuario`, `auth_user_id`, `email`, `nome`.  
Se o insert em `usuarios` falhar, o usuário criado no Auth é removido para não ficar órfão.

**Nota:** em desenvolvimento o cadastro usa `email_confirm: true` para o e-mail já poder logar; em produção você pode exigir confirmação por e-mail e ajustar isso no código.

## Perfil do usuário logado

`GET /auth/me` — retorna a linha de **`public.usuarios`** do usuário autenticado.

Header obrigatório:

- `Authorization: Bearer <access_token>` — JWT devolvido pelo Supabase após login (`signInWithPassword` etc. no front).

Exemplo (troque `SEU_JWT` pelo token real):

```bash
curl -H "Authorization: Bearer SEU_JWT" http://localhost:4000/auth/me
```

Resposta `200`: `{ "usuario": { ... } }`.  
`401` se o token estiver ausente ou inválido. `404` se existir no Auth mas não houver linha em `usuarios`.

### Atualizar perfil (`PATCH /auth/me`)

Mesmo header `Authorization: Bearer <access_token>`. Corpo JSON com **pelo menos um** campo:

- `nome` (opcional)
- `telefone` (opcional; use `null` para limpar)
- `email` (opcional; atualiza Auth + `usuarios`)

Exemplo:

```bash
curl -X PATCH http://localhost:4000/auth/me ^
  -H "Authorization: Bearer SEU_JWT" ^
  -H "Content-Type: application/json" ^
  -d "{\"nome\":\"Novo Nome\",\"telefone\":\"11888887777\"}"
```

## Schema Supabase (mínimo)

Crie a tabela `brand_profiles`:

```sql
create table if not exists public.brand_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id text not null unique,
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_updated_at on public.brand_profiles;
create trigger set_updated_at
before update on public.brand_profiles
for each row
execute function public.set_updated_at();
```

Observação: com `SUPABASE_SERVICE_ROLE_KEY`, o backend consegue ler/escrever mesmo com RLS.
Mais pra frente, quando o Next for escrever pelo browser, aí sim configuramos RLS e policies.

## Testes (na prática)

### Ping do backend

```bash
curl http://localhost:4000/health
```

### Ping do Supabase (via backend)

```bash
curl -H "X-Internal-Secret: SEU_SECRET" \
  http://localhost:4000/internal/supabase/ping
```

### Salvar/atualizar contexto da marca

```bash
curl -X POST http://localhost:4000/internal/brand-context/upsert \
  -H "Content-Type: application/json" \
  -H "X-Internal-Secret: SEU_SECRET" \
  -d "{\"userId\":\"user_123\",\"context\":{\"brand\":\"Loja X\",\"cores\":[\"azul\"],\"tom\":\"divertido\"}}"
```

### Ler contexto da marca

```bash
curl -X POST http://localhost:4000/internal/brand-context \
  -H "Content-Type: application/json" \
  -H "X-Internal-Secret: SEU_SECRET" \
  -d "{\"userId\":\"user_123\"}"
```

