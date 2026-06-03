# Repertório 1000+ — Tuma IA

Gerador automático de **pergunta → resposta** contextualizadas para treino e testes.

## Gerar

```bash
npm run repertorio:1000
# ou
node backend/scripts/gerar-repertorio-1000.mjs --target 1200
```

Opções:

| Flag | Efeito |
|------|--------|
| `--target 1200` | Mínimo de perguntas únicas no catálogo |
| `--sample-size 150` | Quantos exemplos vão para o **prompt** RAG |
| `--llm --llm-limit 50` | Substituir respostas canônicas por LLM real (lento) |

## Arquivos gerados

| Arquivo | Uso |
|---------|-----|
| [`repertorio-1000.json`](./repertorio-1000.json) | Relatório completo (1274+ turnos com multi-turno) |
| [`repertorio-1000.csv`](./repertorio-1000.csv) | Planilha: id, categoria, pergunta, resposta, rota |
| `backend/ia/python/conversa/instrucoes/treino_repertorio_1000.txt` | **Todos** os pares (referência / CI) |
| `backend/ia/python/conversa/instrucoes/treino_repertorio_amostra.txt` | **~150** exemplos diversos → **injetados no prompt** |

O prompt Python **não** carrega os 1000 inteiros (estouraria contexto). Carrega a **amostra estratificada** por categoria.

## Categorias (16)

`SAUDACAO`, `IDENTIDADE`, `ACERVO_LISTA`, `ACERVO_INFO`, `PEDIDO_ARTE`, `EMPRESA`, `CONTEXTOS`, `DATA_HORA`, `FORA_ESCOPO`, `CORRECAO`, `AGRADECIMENTO`, `COMPOSTO`, `CONVERSA_GERAL`, `RUÍDO`, `VARIACAO`, `MULTI_TURNO`

## Rotas

- **deterministic** — identidade, acervo, empresa, data, etc.
- **canonical** — resposta esperada quando não há rota fixa (evita LLM inventar)
- **llm** — só com `--llm`

## Após gerar

Reinicie o backend para recarregar `treino_repertorio_amostra.txt`.

## Ampliar

Edite `backend/scripts/lib/repertorioCatalog.mjs` (listas e combinatórias) e rode de novo.
