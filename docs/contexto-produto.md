# Contexto de produto do TumaIA

## O que o TumaIA é

TumaIA é um SaaS voltado para PMEs que precisam manter presença ativa no Instagram sem depender de um fluxo manual de criação. A proposta central é transformar pedidos simples feitos pelo WhatsApp em posts prontos para aprovação e publicação.

O produto é "WhatsApp-first": o canal principal de entrada para o usuário final é a conversa no WhatsApp. O painel web existe como retaguarda operacional para configurar marca, catálogo, mídias, contextos e dados da empresa.

## Problema que o produto resolve

Pequenas e médias empresas normalmente sofrem com pelo menos um destes problemas:

- falta de tempo para criar posts com frequência;
- dificuldade de manter padrão visual e textual;
- dependência de alguém interno para redigir legenda, pensar em hashtags e montar arte;
- atraso entre a ideia de campanha e a publicação real.

O TumaIA reduz esse atrito automatizando a cadeia entre pedido, geração, aprovação e publicação.

## Fluxo principal ponta a ponta

1. O usuário envia uma mensagem no WhatsApp pedindo um post.
2. Na mensagem, ele descreve o que quer de imagem, de legenda e qual público deseja atingir.
3. A API de WhatsApp entrega o evento para um webhook do `n8n`.
4. O `n8n` identifica o usuário/empresa e consulta no Supabase os contextos relevantes da marca.
5. Esses contextos podem incluir catálogo, estilo visual, cores, referências, tom de voz e outras instruções salvas anteriormente.
6. A camada de IA usa esse contexto para gerar a proposta do post.
7. A imagem é gerada a partir do pedido do usuário e do contexto da marca. No fluxo de produto descrito hoje, essa etapa usa Google Gemini.
8. O sistema também monta descrição, legenda e hashtags coerentes com o pedido e com o público-alvo.
9. O usuário aprova a proposta ou pede uma nova versão.
10. Quando a imagem é aprovada, o ativo é salvo no Supabase.
11. O resultado volta para o WhatsApp para confirmação final.
12. Quando há aprovação final, o sistema publica automaticamente no Instagram via API.

## Exemplo de pedido

Exemplo de input do usuário no WhatsApp:

`Post de camiseta azul para divulgar promoção de inverno, com tom moderno e hashtags para público jovem.`

Esse pedido sozinho não basta para gerar um material bom. O valor do TumaIA está em enriquecer o pedido com o contexto já conhecido da marca antes de chamar a IA.

## Papel de cada parte do sistema

### WhatsApp

Canal principal de solicitação e aprovação. O usuário não precisa abrir o painel para pedir um post simples.

### n8n

Camada de automação que recebe webhooks, coordena etapas do fluxo e conecta serviços externos.

### Supabase

Fonte de verdade para dados da empresa e contexto de marca. Também pode armazenar ativos aprovados e metadados operacionais.

### IA

Responsável por transformar o pedido bruto do usuário em um material publicável:

- entender a intenção do pedido;
- usar o contexto da marca;
- gerar imagem;
- sugerir legenda, descrição e hashtags;
- iterar quando o usuário pede ajustes.

### Frontend Next.js

Painel administrativo e operacional do produto. É onde a empresa faz gestão de:

- contextos;
- identidade da marca;
- catálogo e mídias;
- configurações da empresa;
- acompanhamento e revisão manual de partes do fluxo.

### Backend Express.js

Orquestra as integrações do sistema, centralizando autenticação, rotas multi-tenant, acesso ao Supabase e chamadas para serviços de IA e automação.

## O que outra IA deve assumir como verdade de produto

- O TumaIA não é só um gerador de imagem: ele automatiza um fluxo completo de marketing para Instagram.
- O canal principal para o usuário final é o WhatsApp.
- O painel web existe para configurar e manter o contexto da marca, não para substituir o fluxo conversacional.
- Contexto da marca é parte central do produto. Sem ele, a qualidade da saída cai.
- Aprovação do usuário faz parte do fluxo; a automação não deve presumir publicação imediata sem confirmação.
- Publicação no Instagram é o destino final do fluxo.

## Como pensar o sistema ao implementar features

Ao analisar ou implementar qualquer funcionalidade, trate o projeto nestes termos:

- entrada principal: pedido de marketing via WhatsApp;
- enriquecimento: contexto da empresa no Supabase;
- geração: IA produz imagem + texto + hashtags;
- validação: usuário aprova ou pede nova versão;
- persistência: ativo aprovado e contexto operacional;
- distribuição: publicação no Instagram.

## Nota importante sobre a base de código

O repositório pode conter provedores, rotas e experimentos de IA diferentes ao longo do tempo. Ao trabalhar no código:

- preserve esta visão de produto como referência principal;
- siga a implementação concreta do repositório para detalhes técnicos;
- evite assumir que uma integração específica resume todo o produto;
- quando houver divergência entre experimento técnico e fluxo de negócio, priorize explicitar ambos.
