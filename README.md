# TumaIA

TumaIA é um SaaS para pequenas e médias empresas que automatiza a criação e a publicação de posts para Instagram a partir de pedidos feitos principalmente pelo WhatsApp.

## Visão rápida

No fluxo principal do produto:

1. o cliente pede um post no WhatsApp, descrevendo imagem, legenda e público-alvo;
2. o `n8n` recebe o webhook da API de WhatsApp;
3. o sistema busca no Supabase o contexto da marca daquela empresa, como catálogo, estilo visual, cores e referências;
4. a camada de IA gera a proposta do post, incluindo imagem, descrição e hashtags;
5. o usuário aprova ou pede ajustes;
6. quando aprovado, o ativo é salvo no Supabase;
7. o conteúdo volta para aprovação final no WhatsApp;
8. se houver aprovação final, a publicação acontece automaticamente no Instagram via API.

O painel em Next.js é o backoffice do produto: nele a empresa gerencia contexto, identidade da marca, mídias e configurações operacionais. O backend em Express.js concentra autenticação, multi-tenant, integrações com Supabase e orquestração das rotas de IA e automação.

## Estrutura do monorepo

- `frontend/`: painel web em Next.js para gestão da empresa e dos contextos.
- `backend/`: API em Node.js/Express para autenticação, empresas, IA e integrações internas.
- `docs/`: documentação de produto, arquitetura e materiais de apoio.

## Documentação

- Contexto de produto: [`docs/contexto-produto.md`](./docs/contexto-produto.md)
- Documentação geral: [`docs/README.md`](./docs/README.md)
- Backend: [`backend/README.md`](./backend/README.md)
- Frontend: [`frontend/README.md`](./frontend/README.md)

## Desenvolvimento

Em **dois terminais** na raiz do projeto:

```bash
npm run dev    # backend (estável) + frontend
npm run whats  # WPP Connect (WhatsApp)
```

Na primeira conexão do WhatsApp: `npm run whats:session` (QR no terminal do `whats`).

- Backend com hot-reload: `npm run dev:watch`
- Tudo em um terminal só: `npm run dev:mono`
- Ajustes por pacote: veja os READMEs de `backend/` e `frontend/`
