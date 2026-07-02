# IA Python (chat RAG)

Worker de chat da Tuma: recuperação de contexto (Chroma), orquestração de prompt e chamada ao LLM.

Integração com o backend Node via `backend/src/services/chatPythonWorker.js` (subprocesso `chat_worker.py`).

**Stack e estado do produto:** [`../../../docs/stack-e-estado-atual.md`](../../../docs/stack-e-estado-atual.md)

## Módulos principais

| Arquivo | Papel |
|---------|--------|
| `chat_worker.py` | Entrada JSON stdin/stdout para o Node |
| `conversa/orquestrador.py` | Monta prompt, chama modelo, retorna resposta |
| `conversa/indice_vetorial.py` | Chroma em `indice_contextos/` |
| `conversa/recuperacao_contexto.py` | Busca semântica |
| `conversa/provedores.py` | Ollama / OpenRouter |
| `conversa/identidade.py` | Respostas rápidas (oi, quem é você, etc.) |
| `conversa/instrucoes/*.txt` | **Regras canônicas** injetadas no prompt |
| `schema_supabase.py` | Schema Postgres opcional no prompt |

Documentação das regras: [`../../../docs/ia/regras-tuma-ia.md`](../../../docs/ia/regras-tuma-ia.md)

## Instalação

```bash
cd backend/ia/python
python -m venv .venv
.venv\Scripts\activate    # Windows
pip install -r requirements.txt
```

O backend Node sobe o worker automaticamente; não é obrigatório rodar o CLI manualmente.

## CLI local (opcional)

```bash
python -m conversa
```

## Ollama (padrão do repositório)

No `backend/.env`:

```env
LLAMA_BASE_URL=http://127.0.0.1:11434/v1
LLAMA_MODEL=qwen2.5:3b
OLLAMA_CHAT_MODEL=qwen2.5:3b
LLAMA_API_KEY=ollama
```

```bash
ollama pull qwen2.5:3b
ollama pull nomic-embed-text   # embeddings RAG
```

## Variáveis úteis (Python)

| Variável | Efeito |
|----------|--------|
| `TUMACORE_K_CONTEXTO` | Trechos RAG (padrão 4) |
| `TUMACORE_SKIP_RAG_ON_SQL` | Pula Chroma em perguntas SQL |
| `TUMACORE_FORCE_REINDEX` | Força reindexação Chroma |
| `OLLAMA_EMBEDDING_MODEL` | Modelo de embedding (padrão `nomic-embed-text`) |

## Índice Chroma

Se trocar de provedor de embedding (dimensão diferente), o índice em `indice_contextos/` pode ser recriado automaticamente. Em dúvida: apague `indice_contextos/` e reinicie o backend.

## Após editar instruções

Arquivos em `conversa/instrucoes/*.txt` são lidos na subida do worker.

**Reinicie o backend** após qualquer alteração.
