# TumaIA Frontend

Painel web do TumaIA construído em Next.js. Este frontend funciona como retaguarda operacional do produto: nele a empresa configura contexto, identidade da marca, mídias, dados cadastrais e partes do fluxo que alimentam a automação no WhatsApp e a publicação no Instagram.

## Papel no produto

O TumaIA é um sistema "WhatsApp-first": o usuário final pode pedir posts pelo WhatsApp, enquanto o painel serve para preparar e manter o contexto necessário para que a IA gere materiais coerentes com a marca.

Na prática, o frontend é usado para:

- cadastrar e editar dados da empresa;
- manter identidade de marca, estilo visual e referências;
- subir contextos e mídias de apoio;
- revisar partes do fluxo de geração;
- operar áreas do produto que exigem interface administrativa.

## Stack

- Next.js
- React
- App Router

## Desenvolvimento

```bash
cd frontend
npm install
npm run dev
```

Aplicação local: [http://localhost:3000](http://localhost:3000)

## Relação com o restante do sistema

- `frontend/` entrega o painel da empresa.
- `backend/` expõe autenticação, dados multi-tenant, rotas de IA e integrações.
- `Supabase` persiste empresas, contextos, mídias e demais dados operacionais.
- `n8n` e integrações externas cuidam do fluxo automatizado entre WhatsApp, IA e Instagram.

## Leitura complementar

- Visão geral do produto: [`../docs/contexto-produto.md`](../docs/contexto-produto.md)
- README raiz: [`../README.md`](../README.md)
