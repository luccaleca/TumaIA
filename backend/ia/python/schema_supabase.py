"""
Leitura do schema PostgreSQL (Supabase) para contexto dinâmico no TumaCore.

Use um usuário com permissão só leitura quando possível. A URL está em
SUPABASE_DATABASE_URL (ou DATABASE_URL), no formato do painel:
Settings → Database → Connection string (URI).
"""

from __future__ import annotations

import os
import threading
import time
from pathlib import Path

from dotenv import load_dotenv

_DEFAULT_MAX_TABLES = 120
_DEFAULT_MAX_CHARS = 120_000

# Limites usados só no chat (cache). Menores = menos tokens e resposta mais rápida.
# Ajuste com TUMACORE_SCHEMA_MAX_TABLES e TUMACORE_SCHEMA_MAX_CHARS no .env.
_DEFAULT_CHAT_MAX_TABLES = 30
_DEFAULT_CHAT_MAX_CHARS = 40_000

_schema_cache_lock = threading.Lock()
_schema_cache_text: str | None = None
_schema_cache_err: str | None = None
_schema_cache_mono: float = 0.0


def _carregar_env() -> None:
    root = Path(__file__).resolve().parent.parent
    load_dotenv(root / "config" / ".env", override=False)
    load_dotenv(root / ".env", override=False)


def obter_database_url() -> str | None:
    _carregar_env()
    url = (
        os.getenv("SUPABASE_DATABASE_URL", "").strip()
        or os.getenv("DATABASE_URL", "").strip()
    )
    return url or None


def _int_env(nome: str, padrao: int, minimo: int, maximo: int) -> int:
    raw = (os.getenv(nome) or "").strip().replace("_", "")
    if not raw:
        v = padrao
    else:
        try:
            v = int(raw)
        except ValueError:
            v = padrao
    return max(minimo, min(v, maximo))


def limites_schema_para_chat() -> tuple[int, int]:
    """
    Tabelas e tamanho máximo do texto do schema injetado no chat.
    ``GET /supabase/schema-summary`` não usa estes limites (continua com o padrão amplo).
    """
    _carregar_env()
    tabelas = _int_env(
        "TUMACORE_SCHEMA_MAX_TABLES",
        _DEFAULT_CHAT_MAX_TABLES,
        1,
        500,
    )
    chars = _int_env(
        "TUMACORE_SCHEMA_MAX_CHARS",
        _DEFAULT_CHAT_MAX_CHARS,
        2_000,
        500_000,
    )
    return tabelas, chars


def buscar_resumo_schema(
    database_url: str | None = None,
    schemas: tuple[str, ...] = ("public",),
    max_tables: int = _DEFAULT_MAX_TABLES,
    max_chars: int = _DEFAULT_MAX_CHARS,
) -> str:
    """
    Monta texto tipo dicionário de dados: tabelas e colunas dos schemas informados.

    O chat usa ``obter_resumo_schema_cacheado()``, que aplica limites menores
    (env ``TUMACORE_SCHEMA_MAX_*``) para reduzir latência. Este método, chamado
    direto (ex.: ``GET /supabase/schema-summary``), mantém os padrões amplos.
    """
    import psycopg2

    url = database_url or obter_database_url()
    if not url:
        raise RuntimeError(
            "Defina SUPABASE_DATABASE_URL (ou DATABASE_URL) em config/.env — "
            "use a connection string do Postgres no painel do Supabase."
        )

    conn = psycopg2.connect(url, connect_timeout=15)
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT table_schema, table_name
                FROM information_schema.tables
                WHERE table_schema = ANY(%s)
                  AND table_type = 'BASE TABLE'
                ORDER BY table_schema, table_name
                LIMIT %s
                """,
                (list(schemas), max_tables),
            )
            tabelas = cur.fetchall()

            linhas: list[str] = [
                "# Schema Supabase (PostgreSQL) — TumaCore",
                f"# Schemas: {', '.join(schemas)}",
                "",
            ]

            # Uma ida ao Postgres para todas as colunas (antes: 1 query por tabela = muito lento no Supabase).
            colunas_por_tabela: dict[tuple[str, str], list[tuple[str, str, str]]] = {}
            if tabelas:
                sch_arr = [r[0] for r in tabelas]
                tab_arr = [r[1] for r in tabelas]
                cur.execute(
                    """
                    SELECT c.table_schema, c.table_name, c.column_name, c.data_type, c.is_nullable
                    FROM information_schema.columns c
                    WHERE (c.table_schema, c.table_name) IN (
                      SELECT sch, tbl FROM unnest(%s::text[], %s::text[]) AS _(sch, tbl)
                    )
                    ORDER BY c.table_schema, c.table_name, c.ordinal_position
                    """,
                    (sch_arr, tab_arr),
                )
                for s, t, col_name, data_type, nullable in cur.fetchall():
                    key = (s, t)
                    colunas_por_tabela.setdefault(key, []).append(
                        (col_name, data_type, nullable)
                    )

            for schema, tabela in tabelas:
                linhas.append(f"## {schema}.{tabela}")
                cols = colunas_por_tabela.get((schema, tabela), [])
                for col_name, data_type, nullable in cols:
                    null = "NULL" if nullable == "YES" else "NOT NULL"
                    linhas.append(f"- {col_name}: {data_type} {null}")
                linhas.append("")

        texto = "\n".join(linhas).strip()
        if len(texto) > max_chars:
            texto = (
                texto[: max_chars - 200]
                + "\n\n# … (truncado no limite max_chars; no chat ajuste TUMACORE_SCHEMA_MAX_CHARS "
                "ou TUMACORE_SCHEMA_MAX_TABLES no .env)\n"
            )
        return texto
    finally:
        conn.close()


def testar_conexao() -> tuple[bool, str]:
    """Retorna (ok, mensagem)."""
    try:
        url = obter_database_url()
        if not url:
            return False, "SUPABASE_DATABASE_URL não definida."
        import psycopg2

        conn = psycopg2.connect(url, connect_timeout=10)
        try:
            with conn.cursor() as cur:
                cur.execute("SELECT 1")
                cur.fetchone()
            return True, "Conexão OK."
        finally:
            conn.close()
    except Exception as e:
        return False, str(e)


def _ttl_segundos_schema() -> float:
    raw = os.getenv("TUMACORE_SCHEMA_CACHE_TTL_SECONDS", "90").strip() or "90"
    try:
        return max(0.0, float(raw.replace(",", ".")))
    except ValueError:
        return 90.0


def invalidar_cache_schema() -> None:
    """Força nova leitura do schema na próxima chamada a obter_resumo_schema_cacheado."""
    global _schema_cache_text, _schema_cache_err, _schema_cache_mono
    with _schema_cache_lock:
        _schema_cache_text = None
        _schema_cache_err = None
        _schema_cache_mono = 0.0


def obter_resumo_schema_cacheado() -> tuple[str | None, str | None]:
    """
    Lê o resumo do schema do Postgres com cache em memória (TTL via env).

    Retorna (texto, erro):
    - (None, None) — SUPABASE_DATABASE_URL não configurada;
    - (None, mensagem) — falha ao conectar ou ler;
    - (texto, None) — sucesso (pode ser string vazia em caso extremo).
    """
    global _schema_cache_text, _schema_cache_err, _schema_cache_mono

    url = obter_database_url()
    if not url:
        return None, None

    ttl = _ttl_segundos_schema()
    now = time.monotonic()
    with _schema_cache_lock:
        if (
            _schema_cache_text is not None
            and ttl > 0
            and (now - _schema_cache_mono) < ttl
        ):
            return _schema_cache_text, None
        if _schema_cache_err is not None and ttl > 0 and (now - _schema_cache_mono) < ttl:
            return None, _schema_cache_err

    try:
        max_tab, max_ch = limites_schema_para_chat()
        texto = buscar_resumo_schema(
            database_url=url,
            max_tables=max_tab,
            max_chars=max_ch,
        )
        with _schema_cache_lock:
            _schema_cache_text = texto
            _schema_cache_err = None
            _schema_cache_mono = time.monotonic()
        return texto, None
    except Exception as e:
        err = str(e)
        with _schema_cache_lock:
            _schema_cache_text = None
            _schema_cache_err = err
            _schema_cache_mono = time.monotonic()
        return None, err
