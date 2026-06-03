# Bateria de 120 mensagens — diálogo, identidade e anti-erros

Arquivo: [`bateria-treino-dialogo-120.csv`](./bateria-treino-dialogo-120.csv)

Complementa a bateria de intenções (produtos/acervo) com foco em:

- identidade do Tuma (sem listar produtos)
- repetição e continuidade multi-turno
- correções do usuário («não era isso», «para de repetir»)
- respostas genéricas proibidas (suplementos de musculação, meta-linguagem)
- capacidade vs pedido de arte

## Colunas

| Coluna | Uso |
|--------|-----|
| `id` | 1–120 |
| `mensagem` | Texto do usuário |
| `intencao` | Rótulo esperado na camada 1 |
| `continua_anterior` | `sim` se depende do turno anterior |
| `contexto_assistente_anterior` | Última fala do Tuma (multi-turno) |
| `deve_conter` | Substrings esperadas na resposta (pipe = ou) |
| `nao_deve_conter` | Substrings proibidas (pipe = ou) |
| `notas` | Comportamento esperado |

## Intenções desta bateria

| Código | Significado |
|--------|-------------|
| `SAUDACAO` | oi, bom dia |
| `IDENTIDADE_TUMA` | nome, quem é você, apresentação |
| `DUVIDA_CAPACIDADE` | você consegue? / dá pra fazer arte? |
| `COMO_FUNCIONA` | fluxo chat → resumo → prévia |
| `LISTAR_PRODUTOS` | listar acervo (dinâmico no Supabase) |
| `INFO_PRODUTO` | tem X? (dinâmico) |
| `INFO_EMPRESA` | cadastro empresa |
| `AGRADECIMENTO` | valeu, tchau |
| `CORRECAO_USUARIO` | não era isso, para de repetir |
| `COMPOSITO` | várias perguntas numa mensagem |

## Fora do escopo (data, clima, piada)

Bateria dedicada: [`bateria-treino-fora-escopo.csv`](./bateria-treino-fora-escopo.csv)

- Data/hora → relógio do servidor (Brasília), rota `out_of_scope`
- Proibido: inventar dia da semana, «dia útil», pitch «marketing visual da FYT»

## Padrões de erro de LLM

Catálogo técnico: [`padroes-erro-llm-tuma.md`](./padroes-erro-llm-tuma.md) (15 padrões + mitigação no código).

## Treino no prompt (Python)

Arquivos em `backend/ia/python/conversa/instrucoes/`:

| Arquivo | Conteúdo |
|---------|----------|
| `treino_dialogo_exemplos.txt` | Exemplos positivos (ampliado) |
| `treino_antipadroes.txt` | Erros proibidos (ampliado) |
| `treino_continuidade_multi_turn.txt` | Histórico, sem re-saudar |
| `treino_correcoes_usuario.txt` | Quando o usuário corrige |
| `treino_erros_llm_comuns.txt` | Checklist dos 15 padrões de falha de LLM |

Reinicie o backend após alterar esses `.txt` para recarregar o worker Python.

## Como testar manualmente

1. Empresa com mídias reais cadastradas.
2. Para cada linha com `continua_anterior=sim`, envie primeiro o `contexto_assistente_anterior` como mensagem do assistente (ou reproduza o diálogo no chat).
3. Marque ✅ se `deve_conter` aparece e `nao_deve_conter` não aparece.
4. Meta sugerida: ≥90% nas linhas de identidade/saudação/correção; 100% sem produto inventado nas de acervo.

## Testes automatizados (Node)

```bash
npm test
```

Cobertura de roteamento: `testes/backend/chat-turn-routing.test.js`, `chat-answer-sanitizer.test.js`.
