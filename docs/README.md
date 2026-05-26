# Documentação do TumaIA

Este diretório concentra **documentação de produto, acadêmica e diagramas**. Instruções de ambiente e API ficam nos READMEs de cada pacote do monorepo.

## Leitura recomendada para entender o produto

- [`contexto-produto.md`](./contexto-produto.md): visão de negócio, fluxo ponta a ponta, principais atores e papel de cada parte do sistema.
- [`arquitetura/arquitetura-repositorio.md`](./arquitetura/arquitetura-repositorio.md): visão técnica dos serviços, rotas e integrações do repositório.

## Como costuma ser organizado (referência)

Em projetos de software é comum ter **uma pasta `docs/` na raiz** com subpastas por tipo de conteúdo, por exemplo:

| Pasta / arquivo | Uso típico |
|-----------------|------------|
| `README.md` (raiz do repo) | Visão geral, como rodar, link para `docs/` |
| `docs/` | Textos longos, PDFs, imagens de arquitetura, artigos |
| `docs/adrs/` | *Architecture Decision Records* — decisões técnicas datadas (opcional) |
| `backend/README.md`, `frontend/README.md` | Setup, scripts, convenções **desse** repositório |

Evite duas pastas com o mesmo papel (por exemplo `docs/` e `documentacao/`): isso confunde busca e versionamento.

## Estrutura deste repositório

| Caminho | Conteúdo |
|---------|----------|
| [`contexto-produto.md`](./contexto-produto.md) | Contexto de negócio e fluxo principal do produto |
| [`academico/`](./academico/) | Artigo científico (`.docx`) e resumos em texto |
| [`arquitetura/`](./arquitetura/) | Diagrama de arquitetura (PNG) e diagrama de sequência (SVG) |
| [`diagramas/`](./diagramas/) | Diagramas do modelo de dados / banco (PNG) |

## Desenvolvimento

- Backend: [`../backend/README.md`](../backend/README.md)
- Frontend: [`../frontend/README.md`](../frontend/README.md)
- Worker Python (IA): [`../backend/ia/python/README.md`](../backend/ia/python/README.md)
