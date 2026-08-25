# TumaIA Backend (Node + Express)

API do painel Next.js, WhatsApp (WPPConnect) e automações n8n.

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
| `WPPCONNECT_ENABLED`, `WPPCONNECT_*` | WhatsApp direto |
| `IMAGE_PROVIDER`, `OPENAI_*` / `REPLICATE_*` | Geração de imagem |
| `N8N_INSTAGRAM_WEBHOOK_URL` | Publicação Instagram |
| `MEDIA_BUCKET` | Bucket Supabase para mídias |

Ver comentários completos em `.env.example`.

### WhatsApp (desenvolvimento)

```bash
npm run wppconnect:setup    # uma vez
npm run whats               # WPPConnect em :21465
npm run whats:session       # QR / status
```

No `.env`: `WPPCONNECT_ENABLED=true`. Webhook: `http://localhost:4000/wppconnect/webhook`.

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
| POST | `/chat` | Chat Tuma (worker Python + roteamento Node) |
| POST | `/post-context-proposal` | Briefing / proposta de post |
| POST | `/post-caption` | Legenda + hashtags |
| POST | `/image-preview` | Gera prévia de imagem |
| POST | `/image-preview/plan` | Plano de geração (sem debitar) |
| POST | `/publish-instagram` | Publica via n8n |
| GET | `/arte-brief-defaults` | Defaults do brief de arte |
| GET | `/image-download` | Download de imagem gerada |

Quando o pedido indica post/campanha, o chat pode anexar `post_supplement`, `ui_actions` e `route_image_generation`.

## Rotas — WhatsApp

### `/wppconnect`

- `POST /webhook` — eventos do WPPConnect Server
- `GET /status` — integração ativa?
- `POST /recover` — recuperar sessão

Fluxo: `whatsappBridge.js` → `whatsappInboundService.js` → mesma IA do painel.

## Rotas — automação (`/internal`)

Auth: header `x-internal-secret` ou `Authorization: Bearer` = `INTERNAL_WEBHOOK_SECRET`.

| Rota | Função |
|------|--------|
| `POST /internal/whatsapp/message` | Mensagem WhatsApp via n8n |
| `POST /internal/whatsapp/reset` | Limpa sessão em memória |
| `GET /internal/supabase/ping` | Teste Supabase |
| `GET/POST /internal/replicate/*` | FLUX legado, usage |
| `POST /internal/social-content` | Conteúdo social (Llama JSON) |
| `GET /internal/social-content/usage` | Uso diário de tokens |
| `POST /internal/brand-context` | Contexto de marca (legado) |

## Billing de imagem

Geração **só debita** com flag explícita:

- OpenAI: `OPENAI_ALLOW_BILLING=true` + `OPENAI_API_KEY`
- Replicate: `REPLICATE_ALLOW_BILLING=true` + `REPLICATE_API_TOKEN`

Limites: `imageBilling.js`, `replicateUsage.js` (rajada, teto diário).

## Worker Python (chat RAG)

Subprocesso iniciado por `chatPythonWorker.js`. Instruções em `ia/python/conversa/instrucoes/*.txt`.

Após alterar `.txt`: **reiniciar o backend**.

Documentação: [`ia/python/README.md`](./ia/python/README.md)

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
