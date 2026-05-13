# IA Python (base trazida do TumaCore)

Esta pasta contém a base técnica de IA (RAG + roteamento de provedores) portada do TumaCore para o TumaIA:

- Índice vetorial com Chroma em `conversa/indice_vetorial.py`
- Recuperação de contexto em `conversa/recuperacao_contexto.py`
- Orquestração de prompt + histórico em `conversa/orquestrador.py`
- Provedores LLM/embeddings (Ollama / OpenRouter) em `conversa/provedores.py`
- Leitura de schema SQL no Postgres em `schema_supabase.py`

## Importante

Os arquivos de instrução em `conversa/instrucoes/*.txt` foram deixados como **TODO** para você criar do zero no TumaIA (sem reaproveitar regras do TumaCore).

## Instalação

No diretório `backend/ia/python`:

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

## Execução rápida (CLI)

```bash
python -m conversa
```

Isso inicia o loop de chat local com RAG.

## Ollama (local)

Defina no `.env` (raiz do projeto ou `config/.env`):

```env
OLLAMA_HOST=http://127.0.0.1:11434
OLLAMA_CHAT_MODEL=llama3.2:3b
OLLAMA_EMBEDDING_MODEL=nomic-embed-text
```

Com `OLLAMA_CHAT_MODEL` preenchido, o fluxo prioriza Ollama para chat.
