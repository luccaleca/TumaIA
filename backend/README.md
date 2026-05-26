# TumaIA Backend (Node + Express)

## O que é

API do TumaIA para o painel em Next.js, automações em `n8n` e integrações do fluxo de criação/publicação de posts.

No contexto do produto, o backend participa de um fluxo em que:

- o usuário pede um post pelo WhatsApp;
- o `n8n` recebe o webhook;
- o sistema consulta no Supabase o contexto da marca;
- a camada de IA gera proposta de imagem, legenda e hashtags;
- o usuário aprova ou pede ajustes;
- o ativo aprovado é salvo e pode seguir para publicação no Instagram.

Dentro do repositório, o backend concentra autenticação, multi-tenant, acesso ao Supabase, rotas de IA e endpoints internos usados pelas automações.

**Painel (JWT, usuário logado)** — `src/routes/ia.js`:

- `POST /ia/chat` — worker Python (texto). Quando o pedido parece post/campanha social e há `id_empresa` + **Llama** configurado no Node (`LLAMA_BASE_URL` e/ou `LLAMA_MODEL`, API OpenAI-compatível, ex. Ollama), o backend anexa **`post_supplement`**: texto de confirmação do entendimento, **`links`** só para `contexto_empresa` / `midia` reais (com URLs `/painel/contextos?contexto=` e `/painel/midias?midia=`), e **`post_context_proposal`** para a geração de imagem; nesse caso também envia **`ui_actions`** com um único botão: confirmar e gerar prévia (Replicate).
- `POST /ia/post-context-proposal` — (JWT) `history` + `id_empresa`: lê `empresa`, `contexto_empresa` e `midia` no Supabase e usa **Llama** (mesma API) para `confirmation_message` + `post_context_proposal` + `ui_actions` (passo “gerar imagem”). Requer `LLAMA_BASE_URL` e/ou `LLAMA_MODEL` no `.env` do backend.
- `POST /ia/image-preview` — prévia Replicate: body `history`, **`id_empresa` obrigatório**, opcionais `aspect_ratio`, **`post_context_proposal`**, **`reference_midia_ids`** (até **3** UUIDs de `midia` tipo imagem da empresa). Carrega contextos ativos + resumo da empresa e monta o prompt. Com **`reference_midia_ids`**, usa **FLUX 1.1 Pro** com `image_prompt` na **primeira** mídia (URL pública ou assinada do Supabase); a **2ª e 3ª** entram como texto extra no prompt (a API aceita uma imagem por chamada). Sem referências usa **FLUX Schnell** (texto só). O painel envia `reference_midia_ids` a partir de `post_context_proposal.midias_referenced` quando o Llama preenche. Com `IMAGE_PREVIEW_LOG_PROMPT=true`, log do prompt no stderr. Só debita com `REPLICATE_ALLOW_BILLING=true` e token; mesmos limites da rota interna.

As rotas em `/internal/*` são protegidas por `INTERNAL_WEBHOOK_SECRET`.

- `GET /internal/replicate/ping` — valida `REPLICATE_API_TOKEN` com a API da Replicate.
- `POST /internal/replicate/flux-schnell` — gera imagem com `black-forest-labs/flux-schnell` (body JSON: `prompt`, opcionais `aspect_ratio`, `num_outputs`, `output_format`, `output_quality`). Consome créditos na conta Replicate.
- `GET /internal/replicate/usage` — contagem local do dia (sucessos/falhas).

**Segurança (créditos Replicate):** rotas internas exigem `INTERNAL_WEBHOOK_SECRET`. **Nenhuma geração cobrada ocorre** sem `REPLICATE_ALLOW_BILLING=true` (o token sozinho só permite ping/uso). Com billing ativo: **rajada** (`REPLICATE_BURST_PER_MINUTE`, padrão **6**; `0` = sem limite por minuto), **teto diário de sucessos** (`REPLICATE_DAILY_SUCCESS_CAP`, padrão **50**; `0` = ilimitado — o servidor avisa no log ao subir), e **ping** limitado (`REPLICATE_PING_PER_MINUTE`, padrão **10**). Gerações bem-sucedidas escrevem linha `[replicate][billing]` no log. Uso é persistido em `backend/ia/usage/replicate-image-usage.json`. Uma geração por vez no processo (fila) reduz picos por requisições paralelas.

## Setup rápido

1) Copie o arquivo de exemplo:

- `backend/.env.example` → `backend/.env`

2) Preencha:

- `PORT` (opcional; padrão `4000`. Se a porta estiver em uso, defina outra no `.env`, ex. `PORT=4040`)
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (use no backend; **nunca** no browser)
- `INTERNAL_WEBHOOK_SECRET`
- `IMAGE_PREVIEW_LOG_PROMPT` (opcional; `true`/`1`/`yes`/`on` — loga o prompt montado de `/ia/image-preview` no stderr; desligado por padrão)
- `REPLICATE_API_TOKEN` (opcional; necessário para ping e geração)
- `REPLICATE_ALLOW_BILLING` (**obrigatório `true`/`1`/`yes`/`on` para debitar**; padrão desligado — sem isto, `/ia/image-preview` e `POST /internal/replicate/flux-schnell` respondem 503)
- `REPLICATE_BURST_PER_MINUTE` (opcional; padrão **6**; `0` = sem limite por minuto)
- `REPLICATE_PING_PER_MINUTE` (opcional; padrão **10**; `0` = sem limite)
- `REPLICATE_DAILY_SUCCESS_CAP` (opcional; padrão **50** sucessos/dia; `0` = ilimitado)
- `LLAMA_BASE_URL` (opcional; padrão `http://127.0.0.1:11434/v1` — API **OpenAI-compatible**, ex. Ollama)
- `LLAMA_MODEL` (opcional; padrão `llama3.2:3b` nas rotas Node que geram JSON — alinhe ao `ollama list`)
- `LLAMA_API_KEY` (opcional; muitos servidores locais usam `ollama`)
- `LLAMA_DAILY_TOKEN_BUDGET` (opcional; só para a rota `GET /internal/social-content/usage`)

3) Instale e rode:

```bash
cd backend
npm install
npm run dev
```

Smoke da Replicate (1 imagem, **custo real**): exige `REPLICATE_CONFIRM_SMOKE=1` no ambiente ao rodar `npm run test:replicate:smoke`.

URL do servidor: `http://localhost:<PORT>` (padrão `4000`; veja `PORT` no `.env`).

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

### Ver uso de chamadas/tokens de texto — Llama (diário)

```bash
curl -H "X-Internal-Secret: SEU_SECRET" \
  http://localhost:4000/internal/social-content/usage
```

Opcional no `.env`:

```bash
LLAMA_DAILY_TOKEN_BUDGET=200000
```

Com esse valor, a resposta da rota inclui `remaining_tokens_today`.

