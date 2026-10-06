# Arquitetura do repositório (TumaIA)

Diagramas em [Mermaid](https://mermaid.js.org/) — visualizar no GitHub, VS Code ou [mermaid.live](https://mermaid.live).

Estado funcional atual: [`../stack-e-estado-atual.md`](../stack-e-estado-atual.md).

## Visão de containers

Caminho feliz: **Node-first**. WhatsApp Cloud API e painel falam com o monólito Express; chat usa regras + `processChatMessage` / `chatTurnIntent` / `tumaInterpretation`; imagem via `IMAGE_PROVIDER`; Instagram via Meta Graph no backend. Python/RAG/Chroma em `backend/ia/python/` é **legado opcional** (`TUMAIA_NODE_CHAT=false`), fora do fluxo principal.

```mermaid
flowchart TB
  subgraph canais["Canais"]
    WA["WhatsApp\nCloud API"]
    FE["Next.js\npainel"]
  end

  subgraph api["Backend — Node.js + Express"]
    AUTH["/auth"]
    EMP["/empresas"]
    CHAT["/chat"]
    IA["/ia"]
    WAC["/whatsapp/cloud"]
    INT["/internal"]
    HLTH["/health"]
    NODECHAT["Chat Node\nprocessChatMessage\nchatTurnIntent\ntumaInterpretation"]
  end

  subgraph legado["IA Python — legado opcional"]
    CW["chat_worker.py"]
    CHR["Chroma / RAG"]
  end

  subgraph dados["Dados"]
    PG[("Supabase\nPostgres + Auth + Storage")]
  end

  subgraph texto["Texto estruturado Node"]
    LLM["Ollama / cloud / OpenAI\nproposta · legenda"]
  end

  subgraph img["Imagem"]
    GPT["OpenAI gpt-image-2\nou Replicate"]
  end

  subgraph meta["Meta Graph"]
    IG["Instagram API"]
  end

  WA --> WAC
  FE --> AUTH
  FE --> EMP
  FE --> CHAT
  FE --> IA

  WAC --> NODECHAT
  CHAT --> PG
  IA --> PG
  EMP --> PG
  AUTH --> PG
  NODECHAT --> PG

  IA --> NODECHAT
  NODECHAT -.->|"só se TUMAIA_NODE_CHAT=false"| CW
  CW -.-> CHR

  IA --> LLM
  INT --> LLM
  IA --> GPT

  IA -->|"publish-instagram"| IG
```

## Pipeline de chat (caminho feliz — Node)

```mermaid
flowchart LR
  Q["Pergunta + histórico + id_empresa"]
  R["Roteamento Node\ntumaInterpretation\nchatTurnIntent\nprocessChatMessage"]
  D{"Intenção"}
  ID["Identidade / oi"]
  AC["Acervo / empresa\nSupabase"]
  ART["Pedido explícito\nde post / arte"]
  LLM["LLM exceção\nOllama ou cloud"]
  A["Resposta"]

  Q --> R --> D
  D -->|conversa simples| ID --> A
  D -->|acervo / empresa| AC --> A
  D -->|imagem explícita| ART --> A
  D -->|exceção aberta| LLM --> A
```

O worker Python (Chroma + orquestrador RAG) só entra se `TUMAIA_NODE_CHAT=false` — não é o pipeline de produto do protótipo.

## Pipeline de arte (post)

```mermaid
flowchart TD
  P["Pedido explícito de post"]
  B["Briefing / slots\npostContextProposal"]
  C["Confirmação ao usuário"]
  I["image-preview\nOpenAI ou Replicate"]
  CAP["post-caption\nlegenda + hashtags"]
  APR["Aprovação humana"]
  PUB["publish-instagram\nMeta Graph"]

  P --> B --> C --> I --> CAP --> APR --> PUB
```

No WhatsApp, etapas equivalentes via comandos de texto (`gerar imagem`, `gerar legenda`, `publicar no instagram`).

## Rotas principais

| Área | Caminho | Auth | Papel |
|------|---------|------|--------|
| Auth | `/auth/*` | Público / JWT | Registro, login, empresa ativa |
| Empresas | `/empresas/*` | JWT | Multi-tenant, contextos, mídias, identidade |
| Chat | `/chat/*` | JWT | Conversas persistidas |
| IA | `/ia/chat`, `/post-context-proposal`, `/post-caption`, `/image-preview`, `/publish-instagram` | JWT | Fluxo completo de arte |
| WhatsApp | `/whatsapp/cloud/webhook` | Verify token Meta | Mensagens Cloud API |
| Automação | `/internal/*`, `/internal/whatsapp/message` | `x-internal-secret` | Testes, Replicate interno, legado |
| Saúde | `/health` | Público | Diagnóstico |

## Pastas do monorepo

| Pasta | Conteúdo |
|-------|----------|
| `frontend/` | App Router Next.js 16 |
| `backend/src/` | Express, serviços Node (chat, WhatsApp, IA, Instagram) |
| `backend/ia/python/` | Worker RAG legado + instruções `.txt` (prompts ainda usados pelo Node) |
| `testes/` | Testes Node |
| `docs/` | Documentação |

---

*Atualizado com base em `backend/src`, `docs/stack-e-estado-atual.md` e `docs/tcc-arquitetura.md` (pré-V2 / sem agentRuntime).*
