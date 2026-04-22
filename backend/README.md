# TumaIA Backend (Node + Express)

## O que é

API interna para o N8N (e depois o painel Next.js) acessar:

- contexto de marca no Supabase
- (geração com IA pode ser integrada depois neste backend ou no orquestrador)

As rotas em `/internal/*` são protegidas por `INTERNAL_WEBHOOK_SECRET`.

## Setup rápido

1) Copie o arquivo de exemplo:

- `backend/.env.example` → `backend/.env`

2) Preencha:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (use no backend; **nunca** no browser)
- `INTERNAL_WEBHOOK_SECRET`

3) Instale e rode:

```bash
cd backend
npm install
npm run dev
```

Servidor padrão: `http://localhost:4000`

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

