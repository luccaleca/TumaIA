# Contexto de produto do TumaIA

## O que o TumaIA é

TumaIA é um SaaS voltado para PMEs que precisam manter presença ativa no Instagram sem depender de um fluxo manual de criação. A proposta central é transformar pedidos simples — principalmente pelo **WhatsApp** — em posts prontos para aprovação e publicação.

O produto é **WhatsApp-first**: o canal principal de entrada para o usuário final é a conversa. O **painel web** existe como retaguarda para configurar marca, catálogo, mídias e revisar o fluxo de arte.

## Problema que o produto resolve

Pequenas e médias empresas normalmente sofrem com:

- falta de tempo para criar posts com frequência;
- dificuldade de manter padrão visual e textual;
- dependência de alguém interno para legenda, hashtags e arte;
- atraso entre a ideia de campanha e a publicação real.

O TumaIA reduz esse atrito automatizando a cadeia entre pedido, geração, aprovação e publicação.

## Fluxo principal (como está no código hoje)

```mermaid
flowchart LR
  WA[WhatsApp]
  PAINEL[Painel Next.js]
  API[Backend Express]
  SB[(Supabase)]
  AGENTE[Agente Node]
  IMG[Geração de imagem]
  GRAPH[Meta Graph]

  WA -->|Cloud API webhook| API
  PAINEL -->|JWT| API
  API --> SB
  API --> AGENTE
  API --> IMG
  API -->|publicar| GRAPH
  GRAPH --> IG[Instagram]
```

1. O usuário pede um post no **WhatsApp** ou no **painel** (chat).
2. O sistema identifica a **empresa** (telefone + workspace ativo no WhatsApp; JWT + `id_empresa` no painel).
3. Consulta **identidade da marca** e mídias do acervo no Supabase.
4. A **Tuma** (agente) conversa, monta briefing e **proposta de post** quando o pedido é explícito.
5. O usuário confirma e pede **gerar imagem** → provedor configurado (OpenAI gpt-image-2 ou Replicate).
6. Gera **legenda e hashtags** alinhadas ao pedido e à marca.
7. Usuário aprova ou pede ajustes (comandos no WhatsApp ou UI no painel).
8. **Publicação no Instagram** via Meta Graph no backend (quando configurado).

> **Nota:** WhatsApp usa **Cloud API (Meta)** → `/whatsapp/cloud/webhook`. O worker Python/RAG é legado e fica fora do caminho feliz (`TUMAIA_NODE_CHAT=true`).

## Exemplo de pedido

`Post de camiseta azul para promoção de inverno, tom moderno e hashtags para público jovem.`

O valor está em enriquecer o pedido com o **contexto já cadastrado** (cores, logo, produtos em Mídias) antes de chamar a IA.

## Papel de cada parte

### WhatsApp

Canal principal de solicitação e entrega. Comandos de texto (`gerar imagem`, `gerar legenda`, `publicar no instagram`). Exige usuário cadastrado com o mesmo telefone e empresa ativa no painel.

### Painel Next.js

Cadastro, identidade de marca, acervo de mídias, chat persistido, fluxo visual de arte (briefing, prévia, legenda, publicar). Área **TumaCore** (ops) só para dono da plataforma.

### Backend Express

Autenticação, multi-tenant, rotas `/ia`, `/chat`, `/empresas`, `/plataforma`, webhooks `/internal` e `/whatsapp/cloud`, orquestração do agente em Node.

### Supabase

Fonte de verdade: empresas, usuários, identidade, mídias, conversas, storage de imagens geradas.

### IA (Tuma)

- **Chat conversacional** — motor Node (`TUMAIA_NODE_CHAT=true`) com LLM cloud ou Ollama.
- **Roteamento de intenção** — Node decide conversa vs fluxo de arte (`tumaInterpretation`, `processChatMessage`).
- **Proposta e legenda** — serviços Node com LLM conforme env.
- **Imagem** — GPT Image 2 / Replicate com referências do acervo.

### Instagram (Meta Graph)

Publicação direta no backend (`INSTAGRAM_GRAPH_ACCESS_TOKEN` + `INSTAGRAM_BUSINESS_ACCOUNT_ID`).

## O que outra pessoa deve assumir

- Não é só gerador de imagem: é fluxo de marketing para Instagram.
- WhatsApp é canal principal; painel configura e mantém a marca.
- **Aprovação** faz parte do fluxo — não publicar sem confirmação.
- Identidade da marca + acervo são centrais para qualidade.
- Detalhes técnicos atuais: [`stack-e-estado-atual.md`](./stack-e-estado-atual.md).

## Implementação vs visão de produto

- use [`stack-e-estado-atual.md`](./stack-e-estado-atual.md) e [`tcc-arquitetura.md`](./tcc-arquitetura.md) para o que **existe**;
- use este documento para o **porquê** de produto.
