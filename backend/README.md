# TumaIA Backend (Node + Express)

API do painel Next.js, WhatsApp Cloud API (Meta) e publicação Instagram via Graph.

**Estado atual e stack:** [`../docs/stack-e-estado-atual.md`](../docs/stack-e-estado-atual.md)

## Setup

1. Copie `backend/.env.example` → `backend/.env`
2. Preencha Supabase, `INTERNAL_WEBHOOK_SECRET` e provedores de IA conforme uso
3. Na raiz do monorepo: `npm install` e `npm run dev:backend`

URL padrão: `http://localhost:4000` (ou `PORT` no `.env`).

### Variáveis essenciais

| Variável | Uso |
|----------|-----|
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Banco, auth admin, storage |
| `SUPABASE_ANON_KEY` | Alguns fluxos de auth |
| `INTERNAL_WEBHOOK_SECRET` | Rotas `/internal/*` |
| `LLAMA_BASE_URL`, `LLAMA_MODEL` | Ollama local (`qwen2.5:3b`) |
| `WHATSAPP_CLOUD_*` | WhatsApp Cloud API (Meta) |
| `IMAGE_PROVIDER`, `OPENAI_*` / `REPLICATE_*` | Geração de imagem |
| `INSTAGRAM_GRAPH_ACCESS_TOKEN` + `INSTAGRAM_BUSINESS_ACCOUNT_ID` | Publicação Instagram (Meta Graph) |
| `MEDIA_BUCKET` | Bucket Supabase para mídias |

Ver comentários completos em `.env.example`.

### WhatsApp (Cloud API)

No `.env`: `WHATSAPP_CLOUD_ENABLED=true` + token + Phone number ID.

Webhook: `GET/POST /whatsapp/cloud/webhook` (em lab, exponha com HTTPS/ngrok).

Status: `GET /whatsapp/cloud/status`.

Usuário precisa **telefone no cadastro** + **workspace ativo** no painel (`id_empresa_ultima`).

## Rotas — painel (JWT)

Prefixo comum: `Authorization: Bearer <token Supabase>` + middlewares `requireUserJwt`, `requireUsuario`.

### `/auth`

- `POST /register`, `POST /login`, `POST /refresh`
- `GET /me`, `PUT /me/empresa-ativa`

### `/empresas`

Empresas, membros, convites, contextos, mídias, identidade de marca. Sempre validar vínculo `usuario_empresa`.

### `/chat`

- `GET/POST /conversas`, `GET/PUT/DELETE /conversas/:id`
- Mensagens persistidas no Supabase

### `/ia`

| Método | Rota | Função |
|--------|------|--------|
| POST | `/chat` | Chat Tuma — motor Node (`TUMAIA_NODE_CHAT=true`; Python/RAG só se desligado) |
| POST | `/post-context-proposal` | Briefing / proposta de post |
| POST | `/post-caption` | Legenda + hashtags |
| POST | `/image-preview` | Gera prévia de imagem |
| POST | `/image-preview/plan` | Plano de geração (sem debitar) |
| POST | `/publish-instagram` | Publica via Meta Graph |
| GET | `/arte-brief-defaults` | Defaults do brief de arte |
| GET | `/image-download` | Download de imagem gerada |

Quando o pedido indica post/campanha, o chat pode anexar `post_supplement`, `ui_actions` e `route_image_generation`.

## Rotas — WhatsApp

### `/whatsapp/cloud`

- `GET /webhook` — verificação Meta (`hub.verify_token`)
- `POST /webhook` — mensagens inbound Cloud API
- `GET /status` — integração ativa / número CONNECTED?

Fluxo: `whatsappBridge.js` → `whatsappInboundService.js` → mesma IA do painel.

## Rotas — automação (`/internal`)

Auth: header `x-internal-secret` ou `Authorization: Bearer` = `INTERNAL_WEBHOOK_SECRET`.

| Rota | Função |
|------|--------|
| `POST /internal/whatsapp/message` | Mensagem WhatsApp (teste / automação) |
| `POST /internal/whatsapp/reset` | Limpa sessão em memória |
| `GET /internal/supabase/ping` | Teste Supabase |
| `GET/POST /internal/replicate/*` | Rotas internas Replicate (legado / testes), usage |
| `POST /internal/social-content` | Conteúdo social (Llama JSON) |
| `GET /internal/social-content/usage` | Uso diário de tokens |
| `POST /internal/brand-context` | Contexto de marca (legado) |

## Billing de imagem

Geração **só debita** com flag explícita:

- OpenAI: `OPENAI_ALLOW_BILLING=true` + `OPENAI_API_KEY`
- Replicate: `REPLICATE_ALLOW_BILLING=true` + `REPLICATE_API_TOKEN`

Limites: `imageBilling.js`, `replicateUsage.js` (rajada, teto diário).

## Chat Node (caminho feliz)

Padrão: `TUMAIA_NODE_CHAT=true` — regras + `processChatMessage` / `chatTurnIntent` / `tumaInterpretation`; LLM (Ollama ou cloud) em exceções.

Os arquivos de instrução em `ia/python/conversa/instrucoes/*.txt` continuam sendo a fonte canônica de prompts/regras (também lidos pelo caminho Node). Após alterar `.txt`: **reiniciar o backend**.

## Worker Python (legado — chat RAG)

Só quando `TUMAIA_NODE_CHAT=false`. Subprocesso via `chatPythonWorker.js` (Chroma + orquestrador). Fora do caminho feliz do produto.

Documentação do legado: [`ia/python/README.md`](./ia/python/README.md)

## Testes

Na raiz do monorepo:

```bash
npm run test
npm run test:all
```

Smoke Replicate (custo real): `REPLICATE_CONFIRM_SMOKE=1 npm run test:replicate:smoke`

## Health

```bash
curl http://localhost:4000/health
npm run dev:status
```

## Leitura complementar

- [`../docs/arquitetura/arquitetura-repositorio.md`](../docs/arquitetura/arquitetura-repositorio.md)
- [`../docs/ia/regras-tuma-ia.md`](../docs/ia/regras-tuma-ia.md)
- [`../CONTRIBUTING.md`](../CONTRIBUTING.md)
