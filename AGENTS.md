# TumaIA — guia para Agentes (Cursor)

SaaS **WhatsApp-first** para PMEs: pedido no WhatsApp → n8n → contexto da marca (Supabase) → IA gera post (imagem + legenda) → aprovação → publicação no Instagram. O painel Next.js é a retaguarda operacional.

Leia antes de codar:

- [`docs/stack-e-estado-atual.md`](docs/stack-e-estado-atual.md) — stack e o que já está implementado
- [`docs/contexto-produto.md`](docs/contexto-produto.md) — fluxo de negócio
- [`docs/arquitetura/arquitetura-repositorio.md`](docs/arquitetura/arquitetura-repositorio.md) — containers e rotas
- [`backend/README.md`](backend/README.md) — API, env, rotas `/ia` e `/internal`
- [`docs/ia/regras-tuma-ia.md`](docs/ia/regras-tuma-ia.md) — regras de comportamento da IA Tuma

---

## Monorepo

| Pasta | Papel |
|-------|--------|
| `frontend/` | Next.js 16 — painel (`npm run dev -w frontend`) |
| `backend/` | Express + serviços Node + worker Python em `backend/ia/python/` |
| `testes/` | Testes Node (`node --test`); **não** ficam dentro de `backend/` ou `frontend/` |
| `n8n-workflows/` | Orquestração WhatsApp / automação externa |
| `docs/` | Produto, arquitetura, materiais de IA |

Stack: **ES modules** (`"type": "module"`), **Zod** para validação de body/query, **Supabase** (Postgres + Auth).

---

## Como rodar

Pré-requisitos: Node.js, `.env` em `backend/` (copiar de `backend/.env.example`), Supabase configurado. Para chat/IA local: Ollama com `qwen2.5:3b` (ver `backend/ia/python/README.md`).

```bash
# Na raiz do repo
npm install
npm run dev              # backend (estável) + frontend
npm run dev:mono         # whats + backend + frontend
npm run whats            # só WPPConnect (WhatsApp)
npm run dev:backend      # só API
npm run dev:frontend     # só painel
npm run dev:status       # diagnóstico portas / Supabase
```

URLs locais: frontend `http://localhost:3000`, backend `http://localhost:4000` (ou `PORT` no `.env`).

Detalhes: [`docs/stack-e-estado-atual.md`](docs/stack-e-estado-atual.md)

### Testes

```bash
npm run test             # backend (todos em testes/backend/*.test.js)
npm run test:frontend
npm run test:all
```

Testes focados (exemplos):

```bash
npm run test:post-caption
node --test testes/backend/tuma-interpretation.test.js
```

**Regra:** lógica nova em `backend/src/` ou `frontend/` que muda comportamento → adicionar ou estender teste em `testes/backend/` ou `testes/frontend/`. Importar código de produção com caminho relativo ao repo (padrão existente).

---

## Multi-tenant (crítico)

Toda feature que toca dados de empresa deve respeitar isolamento por **`id_empresa`**.

- Rotas autenticadas (`/empresas`, `/chat`, `/ia`): JWT Supabase via `requireUserJwt` + `requireUsuario`.
- Antes de ler/escrever dados de uma empresa, validar vínculo em `usuario_empresa` com `ativo = true`.
- Padrão de referência: `assertEmpresaVinculo` em `backend/src/routes/ia.js` e `getMembroAtivoEmpresa` em `backend/src/modules/empresas/shared.js`.
- Queries Supabase: **sempre** filtrar por `id_empresa` quando aplicável; nunca confiar só no UUID vindo do client sem checar membro.
- Permissões de escrita em mídias/contextos: respeitar `podeGerenciarMidias(cargo)` (`administrador` | `editor`).

**Nunca:**

- Retornar dados de outra empresa por UUID adivinhado ou parâmetro trocado.
- Expor `SUPABASE_SERVICE_ROLE_KEY` no frontend ou em respostas de API.

---

## Rotas e segurança

### Painel (JWT)

- `Authorization: Bearer <token Supabase>` em `/auth`, `/empresas`, `/chat`, `/ia`.
- Middlewares: `backend/src/middleware/requireUserJwt.js`, `requireUsuario.js`.

### Internas (n8n / orquestrador)

- Prefixo **`/internal/*`** — só para automação, **não** para o browser.
- Auth: header `x-internal-secret` ou `Authorization: Bearer` com valor de `INTERNAL_WEBHOOK_SECRET`.
- Middleware: `backend/src/middleware/internalAuth.js`.
- Não remover ou enfraquecer essa proteção; não documentar o secret em código commitado.

### Billing de imagem

Geração cobrada **só** com flags explícitas:

- Replicate: `REPLICATE_ALLOW_BILLING=true` + `REPLICATE_API_TOKEN`
- OpenAI: `OPENAI_ALLOW_BILLING=true` + `OPENAI_API_KEY`

Respeitar limites em `imageBilling.js` / `replicateUsage.js` (burst, teto diário). **Não** habilitar billing em testes ou scripts sem intenção explícita do usuário.

---

## Camada de IA Tuma

### Onde vive

| Camada | Caminho |
|--------|---------|
| Regras canônicas (prompt) | `backend/ia/python/conversa/instrucoes/*.txt` |
| Documentação legível | `docs/ia/regras-tuma-ia.md`, `docs/ia/padroes-erro-llm-tuma.md` |
| Chat RAG (Python) | `backend/ia/python/conversa/` |
| Roteamento Node | `processChatMessage.js`, `chatTurnIntent.js`, `imageGenerationIntent.js` |
| Interpretação de intenção | `backend/src/services/tumaInterpretation.js` |
| Proposta de post / legenda | `postContextProposalService.js`, `postCaptionService.js` |
| Prévia de imagem | `backend/src/routes/ia.imagePreview.js`, `imagePreviewPrompt.js` |

### Espelho frontend ↔ backend

Estes arquivos devem permanecer **alinhados** (comentários no código indicam o par):

- `backend/src/services/tumaInterpretation.js` ↔ `frontend/lib/tumaInterpretation.js`
- Outros espelhos: buscar comentário `Espelha` em `frontend/lib/`

Ao alterar roteamento chat vs arte/post, atualizar **ambos** os lados e rodar `testes/backend/tuma-interpretation.test.js` (e testes de frontend relacionados).

### Comportamento esperado da Tuma

- Pergunta hipotética (*"se eu pedir um post, você ajuda?"*) → **conversa**, não abrir fluxo de imagem.
- Pedido explícito de arte/post → fluxo de proposta / prévia / legenda conforme regras em `regras_tuma_ia.txt`.
- Mitigar alucinação de produtos, vazamento de meta-prompt e respostas genéricas — ver camadas em `docs/ia/padroes-erro-llm-tuma.md` (`chatAnswerSanitizer`, `chatProductGuard`, treinos `.txt`).

**Após alterar** `backend/ia/python/conversa/instrucoes/*.txt`: reiniciar o backend (worker Python recarrega na subida).

---

## Convenções de código

- **Escopo mínimo:** mudança focada no pedido; não refatorar arquivos inteiros sem necessidade.
- **Código simples:** sem over-engineering.
- **Não commitar** sem pedido explícito do mantenedor.
- **Não apagar** `backend/.env`, sessão WPPConnect (`tools/wppconnect/server/`) ou dados críticos sem confirmação.
- **Perguntar** se faltar informação — não chutar.
- **UI limpa:** labels curtos na tela; explicação longa fica no chat, não na interface.
- **Linguagem simples:** código, commits e mensagens claros e diretos.
- **Commits:** imperativo, curto (`adiciona…`, `corrige…`); sem 1ª pessoa; sem `Co-authored-by` nem `Made-with: Cursor`.
- **Validação:** Zod nos routers; mensagens de erro em português, JSON `{ error: "..." }`.
- **Rotas empresas:** ordem importa — literais antes de `/:idEmpresa` (ver `backend/src/routes/empresas/index.js`).
- **Frontend Next.js:** regras específicas em [`frontend/AGENTS.md`](frontend/AGENTS.md) (App Router, breaking changes da versão).
- **Secrets:** só em `backend/.env` (nunca commitar `.env`).
- **Documentação longa:** preferir `docs/` ou README do pacote; não duplicar textos enormes em comentários.

---

## Fluxo produto (referência rápida)

```
WhatsApp → n8n webhook → backend /internal (secret)
         → Supabase (empresa, contextos, mídias)
         → /ia (chat, post-context, image-preview)
         → aprovação → publicação Instagram
```

Painel alimenta contexto e identidade; não substitui o canal WhatsApp como entrada principal do usuário final.

---

## Checklist antes de abrir PR

1. `npm run test:all` (ou pelo menos o pacote alterado)
2. Multi-tenant: todo `id_empresa` validado?
3. `/internal` ainda protegido?
4. Mudou interpretação de intenção? Espelho frontend atualizado?
5. Mudou regras `.txt` da IA? Documentação em `docs/ia/` coerente?

---

## Cloud Agents / Automations

Se rodar na nuvem (Cursor Cloud Agent ou Automation):

- Ambiente: configurar install (`pnpm install` / `npm install`) e testes no [dashboard Cloud Agents](https://cursor.com/dashboard/cloud-agents).
- Secrets sensíveis só no dashboard — não no repo.
- Branch base típica: `main`. PRs de fork não disparam automations de review.

---

## Preferências do mantenedor (completar)

<!-- Edite esta seção com suas preferências pessoais/de produto. -->

- **Prioridade atual do produto:** _(ex.: estabilizar fluxo WhatsApp → prévia de imagem)_
- **Evitar tocar sem pedir:** _(ex.: n8n-workflows em produção, migrations Supabase)_
- **Modelo local padrão:** `qwen2.5:3b` via Ollama — não trocar modelo nos `.env` commitados.
- **Estilo de PR:** commits pequenos; descrição em português.
- **Deploy:** _(preencher quando houver — ex. VPS, Railway, etc.)_

---

## O que pedir ao Agent (exemplos bons)

- "Adiciona teste em `testes/backend/` para o caso X em `tumaInterpretation`."
- "Corrige vazamento de `id_empresa` na rota Y; segue padrão de `assertEmpresaVinculo`."
- "Atualiza espelho em `frontend/lib/tumaInterpretation.js` após mudança no backend."
- "Documenta nova env var em `backend/.env.example` sem valores reais."

## O que evitar pedir sem contexto

- Refatoração grande de `processChatMessage.js` ou do worker Python sem testes.
- Habilitar billing Replicate/OpenAI em scripts de teste.
- Expor rotas `/internal` ao frontend ou remover auth de webhook.
