# Regras do Tuma (100 orientações)

Documentação legível das regras de comportamento da IA. O arquivo **canônico** injetado no prompt do chat está em:

`backend/ia/python/conversa/instrucoes/regras_tuma_ia.txt`

Treino dinâmico (empresa + mídias, tom de funcionário): [`treino-dinamico-tuma.md`](./treino-dinamico-tuma.md) e `papel_funcionario_empresa.txt`.

Após alterar as regras, reinicie o worker Python do chat para recarregar os `.txt`.

## Blocos

| Regras | Tema |
|--------|------|
| 1–15 | Identidade Tuma e papel no TumaIA |
| 16–30 | Empresa em sessão (funcionário de marketing) |
| 31–45 | Conversa normal sem abrir fluxo de imagem |
| 46–60 | Pedido explícito de post/arte |
| 61–75 | Confirmação e prévia no painel |
| 76–85 | Tom, limites e compliance |
| 86–95 | Dados, privacidade e qualidade |
| 96–100 | Regras de ouro |

## Interpretação nativa — 100 dicas (como gente)

Documentação: [`100-dicas-interpretacao-nativa.md`](./100-dicas-interpretacao-nativa.md)

Arquivo para o prompt: `backend/ia/python/conversa/instrucoes/interpretacao_nativa.txt`

Foco: **várias perguntas na mesma mensagem → responder todas**; não parar no primeiro “oi”.

## Interpretação de intenção (100 regras)

Arquivo: `backend/ia/python/conversa/instrucoes/regras_interpretacao_tuma.txt`

Código que aplica antes de abrir prévia de imagem:

- `backend/src/services/tumaInterpretation.js` (e espelho em `frontend/lib/tumaInterpretation.js`)

Exemplo: *"se eu fazer um pedido de uma postagem vc me ajuda?"* → conversa (não arte).

## Onde entra no código

- Chat RAG: `backend/ia/python/conversa/instrucoes/__init__.py` → `REGRAS_TUMA_IA` + `REGRAS_INTERPRETACAO_TUMA`
- Respostas rápidas (oi / quem é você): `backend/ia/python/conversa/identidade.py`
- Roteamento de imagem (regex): `backend/src/services/imageGenerationIntent.js`
- Proposta de arte (Llama): `backend/src/services/postContextProposalService.js` + `tumaIaRegrasResumo.js`
