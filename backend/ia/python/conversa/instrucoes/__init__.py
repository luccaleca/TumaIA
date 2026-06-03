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
REGRAS_TUMA_IA = _ler_txt("regras_tuma_ia.txt")
REGRAS_INTERPRETACAO_TUMA = _ler_txt("regras_interpretacao_tuma.txt")
INTERPRETACAO_NATIVA = _ler_txt("interpretacao_nativa.txt")
PAPEL_FUNCIONARIO_EMPRESA = _ler_txt("papel_funcionario_empresa.txt")
TREINO_DIALOGO_EXEMPLOS = _ler_txt("treino_dialogo_exemplos.txt")
TREINO_ANTIPADROES = _ler_txt("treino_antipadroes.txt")
TREINO_CONTINUIDADE = _ler_txt("treino_continuidade_multi_turn.txt")
TREINO_CORRECOES = _ler_txt("treino_correcoes_usuario.txt")
TREINO_ERROS_LLM = _ler_txt("treino_erros_llm_comuns.txt")
TREINO_CONVERSA_NATURAL = _ler_txt("treino_conversa_natural.txt")

def _carregar_repertorio_prompt(max_chars: int = 90_000) -> str:
    """Amostra estratificada no prompt; arquivo completo (1000+) fica fora do RAG."""
    for nome in (
        "treino_repertorio_amostra.txt",
        "treino_repertorio_conversas.txt",
    ):
        p = _PASTA / nome
        if p.is_file():
            texto = p.read_text(encoding="utf-8").strip()
            if len(texto) > max_chars:
                return texto[:max_chars] + "\n\n[… repertório truncado — ver treino_repertorio_1000.txt …]"
            return texto
    return ""


TREINO_REPERTORIO = _carregar_repertorio_prompt()

_IDENTIDADE_TUMA = (
    "Você é o Tuma IA: assistente de criação de artes e posts para Instagram da empresa "
    "descrita no bloco [DADOS CADASTRAIS DA EMPRESA EM SESSÃO]. Fale como funcionário "
    "de marketing usando o nome fantasia — nunca como «IA que interpreta empresa selecionada».\n"
)


def _prompt_rag_template() -> str:
    return (
        _IDENTIDADE_TUMA
        + f"{SEM_META_RESPOSTA}\n"
        + f"{ESTILO_CONVERSA}\n"
        + f"{INTERPRETACAO_NATIVA}\n\n"
        + f"{PAPEL_FUNCIONARIO_EMPRESA}\n\n"
        + f"{TREINO_ERROS_LLM}\n\n"
        + f"{TREINO_CONVERSA_NATURAL}\n\n"
        + f"{TREINO_DIALOGO_EXEMPLOS}\n\n"
        + f"{TREINO_CONTINUIDADE}\n\n"
        + f"{TREINO_CORRECOES}\n\n"
        + f"{TREINO_ANTIPADROES}\n\n"
        + (f"{TREINO_REPERTORIO}\n\n" if TREINO_REPERTORIO else "")
        + "{post_breve_block}"
        + f"\n{_CORPO_REGRAS_RAG}\n\n"
        + f"{REGRAS_TUMA_IA}\n\n"
        + f"{REGRAS_INTERPRETACAO_TUMA}\n\n"
        + "CONTEXTO:\n{context}\n\n"
        + "PERGUNTA DO USUÁRIO:\n{question}\n\n"
        + "Responda:"
    )


PROMPT_RAG = PromptTemplate(
    input_variables=["context", "question", "post_breve_block"],
    template=_prompt_rag_template(),
)
