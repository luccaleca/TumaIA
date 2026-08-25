# TumaIA

SaaS **WhatsApp-first** para PMEs: pedido no WhatsApp (ou painel) → contexto da marca no Supabase → IA gera post (imagem + legenda) → aprovação → publicação no Instagram.

O painel Next.js é a **retaguarda**: cadastro da empresa, identidade, mídias, chat com a Tuma e fluxo completo de arte.

## Stack (resumo)

| Camada | Tech |
|--------|------|
| Painel | Next.js 16 · React 19 · Tailwind 4 |
| API | Node.js · Express · Zod · ES modules |
| Dados | Supabase (Postgres, Auth, Storage) |
| Chat IA | **Node** (regras + estados + Ollama em exceções) · Python/RAG legado fora do caminho feliz |
| Imagem | OpenAI gpt-image-2 ou Replicate (configurável) |
| WhatsApp (dev) | WPPConnect → webhook no backend |
| Instagram | n8n self-hosted na VPS (só publicar; não no chat) |

Detalhes do **código hoje**: [`docs/stack-e-estado-atual.md`](./docs/stack-e-estado-atual.md)  
**Arquitetura do protótipo** (TCC, piloto 1 empresa, VPS): [`docs/tcc-arquitetura.md`](./docs/tcc-arquitetura.md)

### Por que `docs/tcc-arquitetura.md`?

O protótipo existe para **mostrar que funciona** com ~10–20 pessoas no WhatsApp:

- **Site** = repositório da marca (Supabase); **WhatsApp** = canal do pedido, não chatbot genérico.
- **Interpretação por regras + máquina de estados** no Node (briefing → arte → legenda → publicar), **sem RAG** no caminho crítico.
- **LLM** só em conversa aberta / exceção — não a cada “oi”.
- **n8n na VPS** só para publicar no Instagram (sem plano cloud Starter).
- **Runtime:** monólito Node (`TUMAIA_NODE_CHAT=true`); `backend/ia/python/` fica legado até arquivar.

## Estrutura do monorepo

| Pasta | Papel |
|-------|--------|
| `frontend/` | Painel web (Next.js) |
| `backend/` | API Express + worker Python em `backend/ia/python/` |
| `testes/` | Testes `node --test` (fora de backend/frontend) |
| `docs/` | Produto, arquitetura, IA |
| `tools/wppconnect/` | WPPConnect local (clone em `setup`) |
| `n8n-workflows/` | Automação externa (referência) |

## Desenvolvimento

```bash
npm install
cp backend/.env.example backend/.env   # preencher Supabase e secrets
```

### Comandos principais

| Comando | O que sobe |
|---------|------------|
| `npm run dev` | Backend + frontend |
| `npm run whats` | Só WPPConnect (WhatsApp) |
| `npm run dev:mono` | WhatsApp + backend + frontend |
| `npm run dev:status` | Status das portas e Supabase |
| `npm run test:all` | Testes |

**Só WhatsApp:** em dois terminais — `npm run dev:backend` e `npm run whats`. O site não precisa ficar aberto depois de configurar conta e workspace.

**Primeira vez no WhatsApp:** `npm run wppconnect:setup` → `npm run whats` → `npm run whats:session` (QR).

**IA local:** [Ollama](https://ollama.com) com `ollama pull qwen2.5:3b`.

URLs: frontend `http://localhost:3000` · backend `http://localhost:4000`

## Documentação

| Doc | Conteúdo |
|-----|----------|
| [`docs/stack-e-estado-atual.md`](./docs/stack-e-estado-atual.md) | Stack + funcionalidades implementadas hoje |
| [`docs/tcc-arquitetura.md`](./docs/tcc-arquitetura.md) | Arquitetura alvo — TCC, VPS, monólito Node, sem RAG no WhatsApp |
| [`docs/contexto-produto.md`](./docs/contexto-produto.md) | Visão de produto e fluxo |
| [`docs/arquitetura/arquitetura-repositorio.md`](./docs/arquitetura/arquitetura-repositorio.md) | Diagramas e rotas |
| [`docs/ia/regras-tuma-ia.md`](./docs/ia/regras-tuma-ia.md) | Comportamento da IA Tuma |
| [`CONTRIBUTING.md`](./CONTRIBUTING.md) | Como contribuir (time / revisão / segurança) |
| [`backend/README.md`](./backend/README.md) | API, env, rotas |
| [`frontend/README.md`](./frontend/README.md) | Painel Next.js |
