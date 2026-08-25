# Contribuindo no TumaIA

Guia para quem desenvolve neste repositório. O TumaIA é um produto em produção/piloto: mudanças devem ser revisáveis, testáveis e seguras para dados multi-empresa.

## Antes de codar

- [`docs/stack-e-estado-atual.md`](docs/stack-e-estado-atual.md) — o que já está implementado
- [`docs/tcc-arquitetura.md`](docs/tcc-arquitetura.md) — arquitetura alvo (TCC, VPS, monólito Node)
- [`docs/contexto-produto.md`](docs/contexto-produto.md) — fluxo de negócio
- [`docs/arquitetura/arquitetura-repositorio.md`](docs/arquitetura/arquitetura-repositorio.md) — containers e rotas
- [`backend/README.md`](backend/README.md) — API, env, rotas `/ia` e `/internal`
- [`docs/ia/regras-tuma-ia.md`](docs/ia/regras-tuma-ia.md) — comportamento da IA Tuma (produto)

## Monorepo

| Pasta | Papel |
|-------|--------|
| `frontend/` | Next.js 16 — painel |
| `backend/` | Express + serviços Node + worker Python em `backend/ia/python/` |
| `testes/` | Testes Node (`node --test`); fora de `backend/` e `frontend/` |
| `n8n-workflows/` | Orquestração / publicação (referência) |
| `docs/` | Produto, arquitetura, IA do produto |

Stack: ES modules (`"type": "module"`), Zod, Supabase (Postgres + Auth).

## Como rodar

Pré-requisitos: Node.js, `backend/.env` (a partir de `backend/.env.example`), Supabase. Chat local: Ollama (ver `backend/ia/python/README.md`).

```bash
npm install
npm run dev              # backend + frontend
npm run dev:mono         # WhatsApp + backend + frontend
npm run whats            # só WPPConnect
npm run dev:backend
npm run dev:frontend
npm run dev:status
```

URLs: frontend `http://localhost:3000` · backend `http://localhost:4000` (ou `PORT` no `.env`).

### Testes

```bash
npm run test
npm run test:frontend
npm run test:all
```

Lógica nova que muda comportamento → teste em `testes/backend/` ou `testes/frontend/`.

## Multi-tenant (obrigatório)

Toda feature que toca dados de empresa isola por **`id_empresa`**.

- Rotas autenticadas: JWT Supabase (`requireUserJwt` + `requireUsuario`).
- Antes de ler/escrever: vínculo ativo em `usuario_empresa` (`assertEmpresaVinculo` / `getMembroAtivoEmpresa`).
- Queries Supabase: filtrar por `id_empresa`; não confiar só no UUID do client.
- Escrita em mídias/contextos: `podeGerenciarMidias(cargo)`.

**Proibido:** vazar dados de outra empresa; expor `SUPABASE_SERVICE_ROLE_KEY` no frontend ou em respostas.

## Segurança de rotas

- Painel: `Authorization: Bearer <token>` em `/auth`, `/empresas`, `/chat`, `/ia`.
- **`/internal/*`**: só automação (n8n); `x-internal-secret` / Bearer com `INTERNAL_WEBHOOK_SECRET`. Nunca chamar do browser.
- Billing de imagem: só com `REPLICATE_ALLOW_BILLING` / `OPENAI_ALLOW_BILLING` explícitos. Não ligar em testes sem necessidade.

## IA do produto (Tuma)

**Caminho feliz do protótipo (sem RAG):**

```text
mensagem → regras / estados (Node) → Supabase (marca, acervo, campanhas)
         → LLM leve só se for conversa aberta
         → briefing → arte → legenda → aprovação → Instagram (n8n)
```

| Camada | Caminho |
|--------|---------|
| Flag do motor | `TUMAIA_NODE_CHAT=true` (padrão) em `backend/.env` |
| Prompts / repertório | `backend/ia/python/conversa/instrucoes/*.txt` (texto; não exige Chroma) |
| Docs | `docs/ia/regras-tuma-ia.md`, `docs/tcc-arquitetura.md` |
| Roteamento | `processChatMessage.js`, `chatTurnIntent.js` |
| Interpretação | `tumaInterpretation.js` (+ espelho em `frontend/lib/`) |
| LLM leve | `chatNodeLlmLight.js` (Ollama HTTP; opcional Cursor A/B local) |
| Post / legenda / prévia | `postContextProposalService.js`, `postCaptionService.js`, `ia.imagePreview.js` |
| Legado RAG | `backend/ia/python/` + `chatPythonWorker.js` — só com `TUMAIA_NODE_CHAT=false` |

Espelho backend ↔ frontend: ao mudar interpretação, atualizar os dois lados e os testes.

Após editar `instrucoes/*.txt`, reiniciar o backend.

## Convenções

- Diff mínimo; sem refatoração oportunista.
- Zod nas rotas; erros em português: `{ error: "..." }`.
- Commits em imperativo, curtos (`adiciona…`, `corrige…`); sem 1ª pessoa.
- Secrets só em `backend/.env` (nunca no Git).
- UI: labels curtos; textos longos fora da interface.
- Next.js 16: APIs podem divergir de versões antigas — consultar a doc da versão em `frontend/`.

## Checklist de PR

1. `npm run test:all` (ou o pacote alterado)
2. `id_empresa` validado onde couber
3. `/internal` ainda protegido
4. Espelho de interpretação atualizado, se aplicável
5. Docs de IA coerentes, se mudou prompt/comportamento

## Prioridade do produto (piloto / TCC)

**Protótipo funcional (mensagem do projeto):** mostrar que o fluxo WhatsApp → briefing → arte → legenda → aprovação funciona **sem RAG no caminho crítico**.

1. Motor padrão: **Node** (`TUMAIA_NODE_CHAT=true`) — regras + estados + dados do Supabase; LLM só em conversa aberta / exceção
2. `backend/ia/python/` (Chroma/RAG) é **legado** — não usar na demo nem no piloto
3. Painel estável; sem regressão no chat e na prévia de imagem
4. Arquitetura alvo: [`docs/tcc-arquitetura.md`](docs/tcc-arquitetura.md)

Evitar sem alinhamento prévio: workflows n8n de produção, migrations destrutivas, billing pago, reativar worker Python, apagar sessão WhatsApp ou `.env`.
