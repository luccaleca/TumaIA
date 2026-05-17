"""Textos de instrução ao modelo (arquivos em ``instrucoes/*.txt``)."""

from pathlib import Path

from langchain_core.prompts import PromptTemplate

_PASTA = Path(__file__).resolve().parent


def _ler_txt(nome: str) -> str:
    return (_PASTA / nome).read_text(encoding="utf-8").strip()


ESTILO_CONVERSA = _ler_txt("estilo_conversa.txt")
PEDIDOS_POST_BREVE = _ler_txt("pedidos_post_breve.txt")
SEM_META_RESPOSTA = _ler_txt("sem_meta_resposta.txt")
SCHEMA_INSTR_SQL = _ler_txt("schema_instrucoes_sql.txt")
SQL_SELECT_FOCUS = _ler_txt("sql_select_focus.txt")
_CORPO_REGRAS_RAG = _ler_txt("corpo_regras_rag.txt")

def _prompt_rag_template() -> str:
    return (
        "Você é um assistente do TumaCore, amigável e didático, que responde em português.\n"
        f"{SEM_META_RESPOSTA}\n"
        f"{ESTILO_CONVERSA}\n"
        "{post_breve_block}"
        f"\n{_CORPO_REGRAS_RAG}\n\n"
        "CONTEXTO:\n{context}\n\n"
        "PERGUNTA DO USUÁRIO:\n{question}\n\n"
        "Responda:"
    )


PROMPT_RAG = PromptTemplate(
    input_variables=["context", "question", "post_breve_block"],
    template=_prompt_rag_template(),
)
