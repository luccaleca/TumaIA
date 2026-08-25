# TumaIA Frontend

Painel web do TumaIA — retaguarda operacional do produto WhatsApp-first.

**Stack e estado do projeto:** [`../docs/stack-e-estado-atual.md`](../docs/stack-e-estado-atual.md)

## Stack

- **Next.js 16** (App Router)
- **React 19**
- **Tailwind CSS 4**
- ES modules (`"type": "module"`)

Next.js 16 pode divergir de versões antigas — consulte a documentação da versão instalada em `node_modules/next/` antes de usar APIs novas.

Guia do monorepo: [`../CONTRIBUTING.md`](../CONTRIBUTING.md).

## Papel no produto

O usuário final pode pedir posts pelo **WhatsApp**. O painel serve para:

- cadastro, login e escolha de **workspace** (empresa ativa)
- identidade de marca, contextos de campanha e **mídias** (acervo)
- **chat** com a Tuma (conversas no Supabase)
- fluxo de **arte**: briefing → proposta → prévia → legenda → publicar no Instagram

Sem workspace ativo no painel, o bot WhatsApp não sabe qual marca atender.

## Desenvolvimento

Na raiz do monorepo (recomendado):

```bash
npm install
npm run dev          # backend + frontend
```

Só o frontend:

```bash
npm run dev:frontend
# ou
cd frontend && npm run dev
```

App: [http://localhost:3000](http://localhost:3000) — API em `http://localhost:4000`

## Espelho backend ↔ frontend

Arquivos que devem permanecer alinhados (comentário `Espelha` no código):

- `frontend/lib/tumaInterpretation.js` ↔ `backend/src/services/tumaInterpretation.js`
- Outros: buscar `Espelha` em `frontend/lib/`

## Leitura complementar

- [`../docs/contexto-produto.md`](../docs/contexto-produto.md)
- [`../README.md`](../README.md)
- [`../backend/README.md`](../backend/README.md)
