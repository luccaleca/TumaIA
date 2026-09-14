"use client";

import { useCallback, useEffect, useState } from "react";
import { authApiFetchWithToken } from "../../../../lib/auth";
import PlataformaPeriodFilter, {
  plataformaRangeQuery,
} from "../PlataformaPeriodFilter";

const FILTROS = [
  { value: "todos", label: "Todos" },
  { value: "ativos", label: "Ativos" },
  { value: "inativos", label: "Inativos" },
  { value: "sem_atividade", label: "Sem atividade" },
];

function formatInt(n) {
  return Number(n || 0).toLocaleString("pt-BR");
}

function formatDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return "—";
  }
}

export default function TumaCoreClientesPage() {
  const [period, setPeriod] = useState(30);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [filtro, setFiltro] = useState("todos");
  const [q, setQ] = useState("");
  const [data, setData] = useState(null);
  const [detail, setDetail] = useState(null);
  const [selectedId, setSelectedId] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const qs = plataformaRangeQuery({ period, from, to });
    const r = await authApiFetchWithToken(
      `/plataforma/clientes?${qs}&filtro=${encodeURIComponent(filtro)}&q=${encodeURIComponent(q)}`,
    );
    if (!r.ok) {
      setData(null);
      setError(r.json?.error || `Falha ao carregar (${r.status || "rede"})`);
      setLoading(false);
      return;
    }
    setData(r.json);
    setLoading(false);
  }, [period, from, to, filtro, q]);

  const openDetail = useCallback(
    async (id) => {
      setSelectedId(id);
      setLoadingDetail(true);
      setDetail(null);
      const qs = plataformaRangeQuery({ period, from, to });
      const r = await authApiFetchWithToken(`/plataforma/clientes/${id}?${qs}`);
      if (!r.ok) {
        setError(r.json?.error || "Falha ao abrir empresa");
        setLoadingDetail(false);
        return;
      }
      setDetail(r.json);
      setLoadingDetail(false);
    },
    [period, from, to],
  );

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    try {
      const focus = sessionStorage.getItem("tumacore-cliente-focus");
      if (focus) {
        sessionStorage.removeItem("tumacore-cliente-focus");
        openDetail(focus);
      }
    } catch {
      /* ignore */
    }
  }, [openDetail]);

  const empresas = Array.isArray(data?.empresas) ? data.empresas : [];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Clientes
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Empresas da plataforma
            {data?.range?.label ? ` · ${data.range.label}` : ""}.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar nome, CNPJ, e-mail…"
            className="w-full min-w-[200px] max-w-xs rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          <div className="flex items-center gap-1 rounded-lg border border-border bg-surface p-1">
            {FILTROS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setFiltro(f.value)}
                className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition ${
                  filtro === f.value
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <PlataformaPeriodFilter
            period={period}
            from={from}
            to={to}
            onChange={(next) => {
              setPeriod(next.period);
              setFrom(next.from);
              setTo(next.to);
            }}
          />
        </div>
      </header>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <section className="overflow-hidden rounded-xl border border-border bg-surface">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold text-foreground">
              Empresas ({formatInt(data?.total || empresas.length)})
            </h2>
          </div>
          {loading && !data ? (
            <p className="p-4 text-sm text-muted-foreground">Carregando…</p>
          ) : (
            <div className="max-h-[560px] overflow-auto">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead className="sticky top-0 bg-muted/80 text-xs uppercase tracking-wide text-muted-foreground backdrop-blur">
                  <tr>
                    <th className="px-3 py-2 font-medium">Empresa</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Membros</th>
                    <th className="px-3 py-2 font-medium">Chat</th>
                    <th className="px-3 py-2 font-medium">Mídias</th>
                  </tr>
                </thead>
                <tbody>
                  {empresas.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-6 text-muted-foreground">
                        Nenhuma empresa neste filtro.
                      </td>
                    </tr>
                  ) : (
                    empresas.map((e) => (
                      <tr
                        key={e.id_empresa}
                        className={`cursor-pointer border-t border-border hover:bg-muted/40 ${
                          selectedId === e.id_empresa ? "bg-muted/50" : ""
                        }`}
                        onClick={() => openDetail(e.id_empresa)}
                      >
                        <td className="px-3 py-2.5">
                          <div className="font-medium text-foreground">{e.nome_fantasia}</div>
                          <div className="text-xs text-muted-foreground">
                            {e.segmento}
                            {e.assinatura_status ? ` · ${e.assinatura_status}` : ""}
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                              e.ativo
                                ? "bg-emerald-500/15 text-emerald-800"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {e.ativo ? "Ativa" : "Inativa"}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 tabular-nums">{formatInt(e.membros)}</td>
                        <td className="px-3 py-2.5 tabular-nums">
                          {formatInt(e.conversas_periodo)}
                        </td>
                        <td className="px-3 py-2.5 tabular-nums">
                          {formatInt(e.midias_periodo)}
                          <span className="text-xs text-muted-foreground">
                            {" "}
                            / {formatInt(e.midias_total)}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-xl border border-border bg-surface p-4">
          {!selectedId ? (
            <p className="text-sm text-muted-foreground">
              Selecione uma empresa na lista para ver detalhes.
            </p>
          ) : loadingDetail ? (
            <p className="text-sm text-muted-foreground">Carregando detalhe…</p>
          ) : detail ? (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  {detail.empresa.nome_fantasia}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {detail.empresa.razao_social} · {detail.empresa.segmento}
                </p>
              </div>
              <dl className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">E-mail</dt>
                  <dd>{detail.empresa.email_principal || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Telefone</dt>
                  <dd>{detail.empresa.telefone_principal || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Instagram</dt>
                  <dd>{detail.empresa.instagram_empresa || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Desde</dt>
                  <dd>{formatDate(detail.empresa.data_criacao)}</dd>
                </div>
              </dl>
              <div className="grid grid-cols-2 gap-2">
                <article className="rounded-lg border border-border p-3">
                  <p className="text-[10px] uppercase text-muted-foreground">Membros</p>
                  <p className="text-xl font-semibold tabular-nums">
                    {formatInt(detail.kpis.membros)}
                  </p>
                </article>
                <article className="rounded-lg border border-border p-3">
                  <p className="text-[10px] uppercase text-muted-foreground">Chat período</p>
                  <p className="text-xl font-semibold tabular-nums">
                    {formatInt(detail.kpis.conversas_periodo)}
                  </p>
                </article>
                <article className="rounded-lg border border-border p-3">
                  <p className="text-[10px] uppercase text-muted-foreground">Mídias período</p>
                  <p className="text-xl font-semibold tabular-nums">
                    {formatInt(detail.kpis.midias_periodo)}
                  </p>
                </article>
                <article className="rounded-lg border border-border p-3">
                  <p className="text-[10px] uppercase text-muted-foreground">CNPJ</p>
                  <p className="truncate text-sm font-medium">
                    {detail.empresa.cnpj || "—"}
                  </p>
                </article>
              </div>
              <div>
                <h3 className="text-sm font-semibold">Equipe</h3>
                <ul className="mt-2 space-y-1 text-sm">
                  {(detail.membros || []).length === 0 ? (
                    <li className="text-muted-foreground">Sem membros ativos.</li>
                  ) : (
                    detail.membros.map((m) => (
                      <li key={m.id_usuario} className="flex justify-between gap-2">
                        <span>
                          {m.nome}{" "}
                          <span className="text-xs text-muted-foreground">({m.email})</span>
                        </span>
                        <span className="text-xs text-muted-foreground">{m.cargo}</span>
                      </li>
                    ))
                  )}
                </ul>
              </div>
              <div>
                <h3 className="text-sm font-semibold">Conversas recentes</h3>
                <ul className="mt-2 space-y-1 text-sm">
                  {(detail.conversas_recentes || []).slice(0, 6).map((c) => (
                    <li key={c.id_conversa} className="flex justify-between gap-2">
                      <span className="truncate">{c.titulo}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatDate(c.data_atualizacao)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
