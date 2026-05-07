"""Decisão de quando usar o índice vetorial e recuperação de trechos."""

import re

from langchain_community.vectorstores import Chroma

try:
    from .. import schema_supabase
except ImportError:
    import schema_supabase

from . import configuracao
from .identidade import pergunta_indica_dados_tuma

# Perguntas sobre SQL / Postgres / Supabase / dicionário de dados → injeta schema ao vivo.
RE_SQL_OU_BANCO = re.compile(
    r"\b("
    r"sql|postgres|postgresql|supabase|script|query|queries|"
    r"select\b|insert\b|update\b|delete\b|merge\b|truncate\b|"
    r"create\s+table|alter\s+table|drop\s+table|create\s+index|"
    r"ddl|dml|migration|migrate|"
    r"schema\b|view\b|índice|indice|constraint|trigger\b|"
    r"join\b|inner\b|outer\b|left\b|right\b|full\b|"
    r"foreign\s+key|primary\s+key|unique\b|references\b|"
    r"tabela|colunas?|campos?|"
    r"banco(\s+de\s+dados)?|dicion[aá]rio\s+de\s+dados|"
    r"information_schema|rls|policy\b|"
    r"returning\b|on\s+conflict|cte\b"
    r")\b",
    re.IGNORECASE,
)

# Perguntas em português sobre estrutura do banco (sem citar SQL explicitamente).
RE_ESTRUTURA_BANCO_PT = re.compile(
    r"\b("
    r"quais\s+(as\s+)?tabelas|"
    r"listar\s+(as\s+)?tabelas|"
    r"mostrar\s+(as\s+)?tabelas|"
    r"estrutura\s+do\s+banco|estrutura\s+das\s+tabelas|"
    r"colunas\s+d(a|o)\s+tabela|"
    r"campos\s+d(a|o)\s+tabela|"
    r"dicion[aá]rio\s+(da\s+)?base|"
    r"modelo\s+de\s+dados|"
    r"o\s+que\s+existe\s+no\s+banco"
    r")\b",
    re.IGNORECASE,
)


def pergunta_quer_contexto_postgres(pergunta: str) -> bool:
    """Se verdadeiro, anexamos o resumo do information_schema lido do banco."""
    if RE_SQL_OU_BANCO.search(pergunta):
        return True
    if RE_ESTRUTURA_BANCO_PT.search(pergunta):
        return True
    return pergunta_indica_dados_tuma(pergunta)


def deve_anexar_schema_postgres(pergunta: str) -> bool:
    """
    Inclui o schema no prompt do chat quando a pergunta indica banco/SQL ou quando
    ``TUMACORE_ANEXAR_SCHEMA_NO_CHAT`` está ativo e ``SUPABASE_DATABASE_URL`` existe.
    """
    if pergunta_quer_contexto_postgres(pergunta):
        return True
    if configuracao.env_bool("TUMACORE_ANEXAR_SCHEMA_NO_CHAT"):
        return bool(schema_supabase.obter_database_url())
    return False


def deve_pular_rag_para_sql(pergunta: str) -> bool:
    """
    Quando ativo via env, evita busca vetorial em perguntas SQL/banco.
    Reduz latência em fluxos focados em SELECT e schema do Postgres.
    """
    return configuracao.env_bool("TUMACORE_SKIP_RAG_ON_SQL", False) and pergunta_quer_contexto_postgres(
        pergunta
    )


def recuperar_documentos_para_resposta(vetor_store: Chroma, pergunta: str) -> list:
    """
    Devolve trechos só quando faz sentido usar contexto:
    - intenção técnica/Tuma/SAP: usa os melhores K (sempre com possibilidade de fontes);
    - caso contrário: só se a relevância do topo passar do limiar (evita 'oi' puxar arquivo).
    """
    texto = pergunta.strip()
    if len(texto) <= 24 and not pergunta_indica_dados_tuma(texto):
        return []

    pairs = vetor_store.similarity_search_with_relevance_scores(
        pergunta, k=configuracao.K_CONTEXTO
    )
    if not pairs:
        return []

    top_score = float(pairs[0][1])
    min_rel = configuracao.min_relevancia()
    força_contexto = pergunta_indica_dados_tuma(pergunta)

    if força_contexto:
        limite = max(0.12, top_score - 0.12)
        return [doc for doc, score in pairs if float(score) >= limite][:4]

    if top_score < min_rel:
        return []

    return [doc for doc, score in pairs if float(score) >= min_rel][:4]
