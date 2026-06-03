# Padrões de erro comuns em LLMs — mapeamento Tuma IA

Este documento liga **falhas típicas de modelos conversacionais** (especialmente modelos pequenos + RAG, como `qwen2.5:3b`) às **mitigações** implementadas no TumaIA.

## Por que estes padrões importam aqui

| Fator no TumaIA | Efeito |
|-----------------|--------|
| Modelo local pequeno | Mais genérico, repete prompt, alucina catálogo |
| Prompt longo (regras + acervo + RAG) | Vazamento de meta-linguagem |
| Domínio «produtos + Instagram» | Estereótipo «suplementos/academia» |
| Roteamento híbrido Node + Python | Falha se o LLM ignorar rota e inventar |

## Catálogo de padrões

| ID | Padrão (inglês comum) | Sintoma no chat | Mitigação |
|----|------------------------|-----------------|-----------|
| 1 | **Hallucination** | Produto/preço/campanha inventados | `chatProductGuard`, bloco ACERVO, treino |
| 2 | **Stereotype anchoring** | «suplementos de musculação» sem mídia | `treino_erros_llm_comuns.txt`, sanitizer |
| 3 | **Prompt leakage** | «empresa em sessão», «regras 31–45» | `sem_meta_resposta.txt`, sanitizer |
| 4 | **False tool use** | «consultei o banco/RAG» | Treino + `chatLlmFailurePatterns` |
| 5 | **Scope confusion** | Nome → lista de produtos | `chatTurnIntent`, `chatIdentityResponse` |
| 6 | **Premature action** | «consegue?» → resumo de arte | Roteamento identidade, treino condicional |
| 7 | **Repetition loop** | Mesma saudação/lista | `chatAnswerSanitizer`, `treino_continuidade` |
| 8 | **Menu bot** | Opção 1, 2, 3 | Filtro de sentenças |
| 9 | **Sycophancy** | «Excelente pergunta!» | Strip de abertura |
| 10 | **Unasked advice** | Hashtags, dicas genéricas | Filtro de sentenças |
| 11 | **Over-generation** | Textão em pergunta curta | Limite ~8 frases (sanitizer) |
| 12 | **Model disclaimer** | «como modelo de linguagem…» | Filtro de sentenças |
| 13 | **Language drift** | Resposta em inglês | Detecção + pedido de reformular |
| 14 | **Apology spiral** | Várias desculpas seguidas | Colapso para uma |
| 15 | **CTA spam** | Post Instagram em toda resposta | Filtro + treino |

## Onde está cada camada

```
Usuário
   → chatTurnIntent (roteamento rápido)
   → acervo / identidade / composite (resposta determinística)
   → Python RAG + treino (*.txt em instrucoes/)
   → guardChatProductAnswer (produtos inventados)
   → sanitizeChatAnswer + chatLlmFailurePatterns (pós-LLM)
```

### Arquivos de treino (Python)

- `treino_erros_llm_comuns.txt` — checklist dos 15 padrões
- `treino_antipadroes.txt` — exemplos ERRADO/CERTO
- `treino_dialogo_exemplos.txt` — exemplos positivos
- `treino_continuidade_multi_turn.txt` — histórico
- `treino_correcoes_usuario.txt` — «não era isso»

### Código (Node)

- `backend/src/services/chatLlmFailurePatterns.js` — regex e filtros
- `backend/src/services/chatAnswerSanitizer.js` — orquestra mitigações

### Teste manual

- [`bateria-treino-dialogo-120.csv`](./bateria-treino-dialogo-120.csv) — colunas `nao_deve_conter` cobrem vários padrões

## Após alterar treino

Reinicie o backend para recarregar o worker Python e teste com **nova conversa** no chat.
