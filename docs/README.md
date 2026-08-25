# Documentação do TumaIA

Documentação de produto, arquitetura e IA. Setup de ambiente fica nos READMEs de cada pacote.

## Comece aqui

| Documento | Para quê |
|-----------|----------|
| [**stack-e-estado-atual.md**](./stack-e-estado-atual.md) | Stack, o que já funciona, como rodar |
| [**tcc-arquitetura.md**](./tcc-arquitetura.md) | **Arquitetura alvo** — TCC, VPS, monólito Node, sem RAG no WhatsApp |
| [contexto-produto.md](./contexto-produto.md) | Visão de negócio e fluxo WhatsApp → Instagram |
| [arquitetura/arquitetura-repositorio.md](./arquitetura/arquitetura-repositorio.md) | Diagramas Mermaid e rotas |

## IA Tuma

| Documento | Conteúdo |
|-----------|----------|
| [ia/regras-tuma-ia.md](./ia/regras-tuma-ia.md) | Regras de comportamento (prompt canônico em `.txt`) |
| [ia/padroes-erro-llm-tuma.md](./ia/padroes-erro-llm-tuma.md) | Sanitização, guardrails, erros comuns |
| [ia/repertorio-1000-README.md](./ia/repertorio-1000-README.md) | Treino de diálogo em escala |
| [ia/bateria-treino-dialogo-README.md](./ia/bateria-treino-dialogo-README.md) | Bateria de treino |

Código canônico de prompt: `backend/ia/python/conversa/instrucoes/`

## Outros

| Caminho | Conteúdo |
|---------|----------|
| [academico/](./academico/) | Artigo e resumos |
| [arquitetura/](./arquitetura/) | Diagramas PNG/SVG |
| [diagramas/](./diagramas/) | Modelo de dados |
| [../CONTRIBUTING.md](../CONTRIBUTING.md) | Como contribuir no repositório |

## Desenvolvimento

- Raiz: [../README.md](../README.md)
- Contribuição: [../CONTRIBUTING.md](../CONTRIBUTING.md)
- Backend: [../backend/README.md](../backend/README.md)
- Frontend: [../frontend/README.md](../frontend/README.md)
- Worker Python: [../backend/ia/python/README.md](../backend/ia/python/README.md)
