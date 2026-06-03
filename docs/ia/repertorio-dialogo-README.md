# Repertório de diálogo — geração automática

## Arquivos

| Arquivo | Descrição |
|---------|-----------|
| [`repertorio-dialogo-gerado.json`](./repertorio-dialogo-gerado.json) | Relatório completo (pergunta, rota, resposta, problemas) |
| [`../backend/ia/python/conversa/instrucoes/treino_repertorio_conversas.txt`](../backend/ia/python/conversa/instrucoes/treino_repertorio_conversas.txt) | Exemplos injetados no prompt RAG |
| [`bateria-treino-dialogo-120.csv`](./bateria-treino-dialogo-120.csv) | Gabarito manual |

## Repertório 1000+

Ver [`repertorio-1000-README.md`](./repertorio-1000-README.md) — `npm run repertorio:1000`

## Gerar / atualizar (versão curta)

```bash
# Pipeline Node (rápido, ~160 turnos — identidade, acervo mock, rotas)
node backend/scripts/simular-repertorio-tuma.mjs

# Incluir respostas do LLM Python (lento; boot do worker na 1ª vez)
node backend/scripts/simular-repertorio-tuma.mjs --llm --llm-limit 30

# Chat real via API (backend rodando + JWT)
node backend/scripts/simular-repertorio-tuma.mjs --live http://127.0.0.1:4000 SEU_JWT ID_EMPRESA_UUID
```

Depois: **reinicie o backend** para recarregar `treino_repertorio_conversas.txt`.

## Métricas do relatório JSON

- `taxa_ok` — respostas sem padrões proibidos (meta, suplementos genéricos, «mudar o foco», etc.)
- `rotas` — quantas foram `identity`, `acervo`, `composite`, `llm_rag`, …
- `problemas` — contagem por tipo de falha detectada na auditoria

## Ampliar o repertório

1. Adicione linhas em `bateria-treino-dialogo-120.csv` ou em `EXTRA_PERGUNTAS` no script.
2. Rode o simulador de novo.
3. Revise entradas com `# revisar:` no `.txt` e corrija código ou treino.
