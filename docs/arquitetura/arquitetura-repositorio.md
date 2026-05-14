# Arquitetura do repositório (TumaIA)

Diagramas em [Mermaid](https://mermaid.js.org/) — visualizar no GitHub, no VS Code (extensão Mermaid) ou em [mermaid.live](https://mermaid.live).

## Visão de containers (o que existe no código hoje)

```mermaid
flowchart TB
  subgraph cliente["Cliente"]
    FE["Next.js\n(frontend)"]
  end

  subgraph api["Backend — Node.js + Express"]
    AUTH["/auth"]
    EMP["/empresas\n(contextos, mídias, membros…)"]
    CHAT["/chat\n(conversas Supabase)"]
    IA["/ia\nchat · post-context · image-preview"]
    INT["/internal\n(segredo — n8n / automação)"]
    HLTH["/health"]
  end

  subgraph py["IA — Python (subprocesso)"]
    CW["chat_worker.py"]
    CHR["Chroma\níndice vetorial"]
    ORQ["orquestrador\nRAG + schema SQL opcional"]
    PRV["provedores\nOllama ou OpenRouter"]
  end

  subgraph dados["Dados"]
    PG[("Supabase\nPostgreSQL")]
    IDX["Arquivos de índice\n(Chroma em disco)"]
  end

  subgraph llama["Texto estruturado (JSON)"]
    LLM["API OpenAI-compatible\nLlama via Ollama\n(LLAMA_*)"]
  end

  subgraph img["Imagem"]
    FLX["Replicate\nFLUX Schnell | FLUX 1.1 Pro"]
  end

  subgraph ext_opcional["Orquestração / produto\n(referência README — fora deste desenho detalhado)"]
    N8N["n8n → /internal"]
  end

  FE --> AUTH
  FE --> EMP
  FE --> CHAT
  FE --> IA

  CHAT --> PG
  IA --> PG
  EMP --> PG
  AUTH --> PG

  IA -->|"runChatSerialized"| CW
  CW --> CHR
  CW --> ORQ
  ORQ --> PRV
  ORQ -->|"schema / empresa"| PG
  CHR --> IDX

  PRV --> OLL["Ollama\n/v1"]
  PRV --> ORT["OpenRouter"]

  IA -->|"post_supplement,\npost-context"| LLM
  INT --> LLM
  IA --> FLX
  INT --> FLX

  N8N -.->|"INTERNAL_WEBHOOK_SECRET"| INT
```

## Pipeline RAG (mensagem → resposta)

```mermaid
flowchart LR
  Q["Pergunta +\nhistórico +\nid_empresa?"]
  E["Embedding\n(Ollama nomic ou\nOpenRouter)"]
  R["Busca semântica\nChroma"]
  C["Contexto:\ntrechos + opcional\nschema Postgres +\ncadastro empresa"]
  L["LLM chat\n(Ollama ou OpenRouter)"]
  A["Resposta +\nsource_documents"]

  Q --> E
  E --> R
  R --> C
  C --> L
  L --> A
```

## Rotas principais (referência rápida)

| Área | Caminho | Papel |
|------|---------|--------|
| Auth | `/auth/*` | Registro/login (Supabase) |
| Multi-tenant | `/empresas/*` | Empresas, contextos, mídias |
| Chat persistido | `/chat/*` | Conversas no Supabase |
| IA painel | `/ia/chat`, `/ia/post-context-proposal`, `/ia/image-preview` | RAG + extras; imagem Replicate |
| Automação | `/internal/*` | Webhooks n8n; Llama JSON; FLUX; usage |

---

*Gerado a partir da estrutura em `backend/src`, `backend/ia/python` e `backend/README.md`. Ajuste o diagrama se novos serviços entrarem no repositório.*
