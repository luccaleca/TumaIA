# Arquitetura do repositório (TumaIA)

Diagramas em [Mermaid](https://mermaid.js.org/) — visualizar no GitHub, VS Code ou [mermaid.live](https://mermaid.live).

Estado funcional atual: [`../stack-e-estado-atual.md`](../stack-e-estado-atual.md).

## Visão de containers

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
  end

  subgraph py["IA — Python subprocesso (legado)"]
    CW["chat_worker.py"]
    CHR["Chroma"]
    ORQ["orquestrador RAG"]
    PRV["Ollama / OpenRouter"]
  end

  subgraph dados["Dados"]
    PG[("Supabase\nPostgres + Storage")]
    IDX["índice Chroma\nem disco"]
  end

  subgraph texto["Texto estruturado Node"]
    LLM["Ollama / Replicate / OpenAI\nproposta · legenda"]
  end

  subgraph img["Imagem"]
    GPT["OpenAI gpt-image-2\nou Replicate"]
    FLX["FLUX via /internal\nlegado"]
  end

  subgraph meta["Meta Graph"]
    IG["Instagram API"]
  end

  WA --> WAC
  FE --> AUTH
  FE --> EMP
  FE --> CHAT
  FE --> IA

  WAC --> api
  CHAT --> PG
  IA --> PG
  EMP --> PG
  AUTH --> PG

  IA --> CW
  CW --> CHR
  CW --> ORQ
  ORQ --> PRV
  ORQ --> PG
  CHR --> IDX

  PRV --> OLL["Ollama /v1"]
  PRV --> ORT["OpenRouter"]

  IA --> LLM
  INT --> LLM
  IA --> GPT
  INT --> FLX

  IA -->|"publish-instagram"| IG
```

## Pipeline RAG (chat Tuma)

```mermaid
flowchart LR
  Q["Pergunta + histórico + id_empresa"]
  R["Roteamento Node\nidentidade · acervo · arte"]
  E["Embedding"]
  C["Chroma + cadastro empresa"]
  L["LLM Ollama"]
  A["Resposta"]

  Q --> R
  R -->|chat RAG| E
  E --> C
  C --> L
  L --> A
```

Antes do Python, o Node pode responder direto (identidade, listagem de acervo, rota composta) via `processChatMessage.js` e `chatTurnIntent.js`.

## Pipeline de arte (post)

```mermaid
flowchart TD
  P["Pedido explícito de post"]
  B["Briefing / slots\npostContextProposal"]
  C["Confirmação ao usuário"]
  I["image-preview\nOpenAI ou Replicate"]
  CAP["post-caption\nlegenda + hashtags"]
  PUB["publish-instagram\nMeta Graph"]

  P --> B --> C --> I --> CAP --> PUB
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
| Automação | `/internal/*`, `/internal/whatsapp/message` | `x-internal-secret` | Testes, Replicate, legado |
| Saúde | `/health` | Público | Diagnóstico |

## Pastas do monorepo

| Pasta | Conteúdo |
|-------|----------|
| `frontend/` | App Router Next.js 16 |
| `backend/src/` | Express, serviços, rotas |
| `backend/ia/python/` | Worker RAG, instruções `.txt` |
| `testes/` | Testes Node |
| `docs/` | Documentação |

---

*Atualizado com base em `backend/src`, `backend/ia/python` e `docs/stack-e-estado-atual.md`.*
