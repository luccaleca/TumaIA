# Stack e estado atual do TumaIA

Documento de referência para humanos e IAs: **o que existe no código hoje** (março/2026). Para visão de produto, veja [`contexto-produto.md`](./contexto-produto.md). Para **arquitetura alvo** (TCC, VPS, monólito Node), veja [`tcc-arquitetura.md`](./tcc-arquitetura.md).

---

## Stack

| Camada | Tecnologia | Observação |
|--------|------------|------------|
| Monorepo | npm workspaces | `frontend`, `backend`, `testes` |
| Painel | **Next.js 16** · React 19 · Tailwind 4 | App Router — `frontend/` |
| API | **Node.js** · Express 4 · **ES modules** · Zod | `backend/src/` |
| Banco / auth | **Supabase** (Postgres + Auth + Storage) | Multi-tenant por `id_empresa` |
| Chat IA (legado) | **Python 3** · Chroma | `backend/ia/python/` — **fora do fluxo principal** |
| Chat IA | **Node** · regras + estados + **agente cloud** | `CHAT_LLM_PROVIDER=cloud` (padrão) |
| LLM chat | Agente cloud · modelo em `CHAT_CLOUD_MODEL` | `CHAT_CLOUD_API_KEY` + `CHAT_CLOUD_MODEL` |
| LLM local (legado / opcional) | **Ollama** · `qwen2.5:3b` | Só se `CHAT_LLM_PROVIDER=ollama` |
| LLM nuvem (opcional) | OpenRouter | Via env no worker Python |
| Texto estruturado (Node) | Ollama / Replicate / OpenAI | Proposta de post, legenda (`TEXT_PROVIDER`) |
| Imagem | **OpenAI gpt-image-2** ou **Replicate** (mesmo modelo) | `IMAGE_PROVIDER`; billing com flag explícita |
| Imagem (legado/interno) | Replicate FLUX Schnell / 1.1 Pro | Rotas `/internal/replicate/*` |
| WhatsApp | **Cloud API (Meta)** | `GET/POST /whatsapp/cloud/webhook` |
| Automação externa | — | Publicação Instagram via Meta Graph no backend |
| Testes | `node --test` | `testes/backend/`, `testes/frontend/` |

---

## O que já funciona (implementado)

### Painel web (`frontend/`)

- Cadastro e login (Supabase Auth, telefone no perfil)
- Multi-empresa: membros, convites, workspace ativo (`id_empresa_ultima`)
- Gestão de empresa: contextos de campanha, identidade de marca, mídias (acervo)
- Chat com a Tuma: conversas persistidas no Supabase (`/chat`)
- Fluxo de arte: briefing → proposta de contexto → prévia de imagem → legenda → publicação Instagram (painel)
- Modelos de post, arte brief, confirmação antes de gerar imagem

### Backend (`backend/`)

- **Auth** `/auth/*` — registro, login, refresh, `/me`, empresa ativa
- **Empresas** `/empresas/*` — CRUD empresa, contextos, mídias, identidade, membros
- **Chat** `/chat/*` — conversas e mensagens (JWT + vínculo empresa)
- **IA** `/ia/*` — chat, proposta de post, legenda, prévia/publicação de imagem
- **Internal** `/internal/*` — webhooks internos, Replicate, brand-context
- **WhatsApp Cloud** `/whatsapp/cloud/webhook` — mensagens Meta Graph
- **Health** `/health` — status API e Supabase

### Camada de IA Tuma

| Função | Onde |
|--------|------|
| Regras de prompt (canônico) | `backend/ia/python/conversa/instrucoes/*.txt` |
| Chat Node (protótipo) | `processChatMessage.js` + `chatNodeLlmLight.js` (`TUMAIA_NODE_CHAT`) |
| Chat RAG Python (legado) | `backend/ia/python/conversa/orquestrador.py` |
| Worker Node ↔ Python (legado) | `backend/src/services/chatPythonWorker.js` |
| Roteamento chat vs arte | `processChatMessage.js`, `chatTurnIntent.js`, `tumaInterpretation.js` |
| Proposta de post / briefing | `postContextProposalService.js` |
| Legenda e hashtags | `postCaptionService.js` |
| Prévia de imagem | `imagePreviewInternal.js`, `ia.imagePreview.js` |
| Sanitização / guardrails | `chatAnswerSanitizer.js`, `chatProductGuard.js` |

Espelho frontend ↔ backend: buscar comentário `Espelha` em `frontend/lib/` (ex.: `tumaInterpretation.js`).

### WhatsApp

1. **Cloud API (Meta)** — `GET/POST /whatsapp/cloud/webhook` → `whatsappBridge.js` → mesma IA do painel  
   - Requer `WHATSAPP_CLOUD_ENABLED=true` + token + Phone number ID no `backend/.env`  
   - Em lab: tunnel HTTPS (ngrok) para a Meta alcançar o backend  
   - Usuário com **telefone cadastrado** + **workspace ativo** no painel  
   - Comandos de texto: `gerar imagem`, `gerar legenda`, `publicar no instagram`, etc.

2. **Internal (teste)** — `POST /internal/whatsapp/message` (secret interno)

### Instagram

- Publicação Instagram direta (Meta Graph: `INSTAGRAM_GRAPH_ACCESS_TOKEN` + `INSTAGRAM_BUSINESS_ACCOUNT_ID`)
- Painel: `POST /ia/publish-instagram`
- WhatsApp: comando `publicar no instagram` após legenda pronta
- Imagem precisa de URL pública (Storage Supabase)

### Geração de imagem

- Provedor configurável: `IMAGE_PROVIDER=openai` ou `replicate`
- Cobrança só com `OPENAI_ALLOW_BILLING=true` ou `REPLICATE_ALLOW_BILLING=true`
- Pipeline `IMAGE_PIPELINE=raw` — prompt focado no pedido; proposta pode usar regras sem Llama (`POST_CONTEXT_USE_LLAMA=false`)
- Referências de produto do acervo (`reference_midia_ids`, composição de cena)

---

## O que ainda é parcial ou depende de config externa

| Item | Situação |
|------|----------|
| Fluxo WhatsApp | Cloud API (Meta); lab com ngrok + `WHATSAPP_CLOUD_*` |
| Publicação Instagram | Credenciais Meta Graph no backend |
| Billing Replicate/OpenAI | Desligado por padrão; ativar só em ambiente intencional |
| Demo `/demo` | Desativada (410) — usar painel Next.js |

---

## Como rodar (resumo)

```bash
npm install
cp backend/.env.example backend/.env   # preencher Supabase, secrets
```

| Comando | Sobe |
|---------|------|
| `npm run dev` | Backend (estável) + frontend |
| `npm run dev:status` | Diagnóstico de portas e Supabase |
| `npm run test:all` | Testes backend + frontend |

**WhatsApp Cloud:** `WHATSAPP_CLOUD_ENABLED=true` + tunnel HTTPS para `/whatsapp/cloud/webhook`.

**IA local:** Ollama com `ollama pull qwen2.5:3b`.

URLs: frontend `http://localhost:3000`, backend `http://localhost:4000` (ou `PORT` no `.env`).

---

## Segurança (não negociar)

- Multi-tenant: sempre filtrar por `id_empresa` e validar `usuario_empresa`
- `/internal/*` e webhooks: `INTERNAL_WEBHOOK_SECRET` / `x-internal-secret`
- Nunca expor `SUPABASE_SERVICE_ROLE_KEY` no frontend
- Secrets só em `backend/.env` (gitignored)

---

## Documentação relacionada

| Arquivo | Conteúdo |
|---------|----------|
| [`tcc-arquitetura.md`](./tcc-arquitetura.md) | Arquitetura alvo — TCC, VPS, sem RAG no WhatsApp |
| [`contexto-produto.md`](./contexto-produto.md) | Visão de negócio e fluxo |
| [`arquitetura/arquitetura-repositorio.md`](./arquitetura/arquitetura-repositorio.md) | Diagramas Mermaid |
| [`ia/regras-tuma-ia.md`](./ia/regras-tuma-ia.md) | Comportamento da IA Tuma |
| [`ia/padroes-erro-llm-tuma.md`](./ia/padroes-erro-llm-tuma.md) | Mitigação de erros de LLM |
| [`../CONTRIBUTING.md`](../CONTRIBUTING.md) | Como contribuir (time / revisão / segurança) |
| [`../backend/README.md`](../backend/README.md) | API, env vars, rotas |
| [`../backend/ia/python/README.md`](../backend/ia/python/README.md) | Worker Python / RAG |
