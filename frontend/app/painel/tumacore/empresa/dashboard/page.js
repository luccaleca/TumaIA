"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { authApiFetchWithToken } from "../../../../../lib/auth";
import PlataformaPeriodFilter, {
  plataformaRangeQuery,
} from "../../PlataformaPeriodFilter";

function KpiCard({ label, value, hint }) {
  return (
    <article className="rounded-xl border border-border bg-surface p-4">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </article>
  );
}

function formatInt(n) {
  return Number(n || 0).toLocaleString("pt-BR");
}

function formatDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return "—";
  }
}

function formatDay(ymd) {
  if (!ymd || String(ymd).length < 10) return String(ymd || "—");
  const [y, m, d] = String(ymd).split("-");
  return `${d}/${m}`;
}

export default function TumaCoreEmpresaDashboardPage() {
  const [period, setPeriod] = useState(7);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const qs = plataformaRangeQuery({ period, from, to });
    const r = await authApiFetchWithToken(`/tumacore/empresa/dashboard?${qs}`);
    if (!r.ok) {
      setData(null);
      setError(r.json?.error || `Falha ao carregar (${r.status || "rede"})`);
      setLoading(false);
      return;
    }
    setData(r.json);
    setLoading(false);
  }, [period, from, to]);

  useEffect(() => {
    load();
  }, [load]);

  const kpis = data?.kpis || {};
  const empresa = data?.empresa || {};
  const evolucao = Array.isArray(data?.evolucao) ? data.evolucao : [];
  const destaques = Array.isArray(data?.destaques) ? data.destaques : [];
  const criacoes = Array.isArray(data?.criacoes_recentes) ? data.criacoes_recentes : [];

  const interacoes =
    (Number(kpis.mensagens_usuario) || 0) + (Number(kpis.mensagens_assistente) || 0);

  const maxEvo = useMemo(() => {
    let m = 1;
    for (const t of evolucao) {
      m = Math.max(m, Number(t.conteudos_gerados) || 0, Number(t.conversas) || 0);
    }
    return m;
  }, [evolucao]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Dashboard</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            O que o TumaIA está fazendo por {empresa.nome_fantasia || "sua empresa"}
            {data?.range?.label ? ` · ${data.range.label}` : ""}.
          </p>
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
      </header>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      {loading && !data ? (
        <p className="text-sm text-muted-foreground">Carregando indicadores…</p>
      ) : null}

      {data ? (
        <>
          <section className="grid grid-cols-2 gap-3 md:grid-cols-4" aria-label="Indicadores">
            <KpiCard
              label="Artes geradas"
              value={formatInt(kpis.conteudos_gerados)}
              hint="Prévias criadas no chat"
            />
            <KpiCard label="Conversas" value={formatInt(kpis.conversas)} />
            <KpiCard
              label="Interações"
              value={formatInt(interacoes)}
              hint="Mensagens do time + Tuma"
            />
            <KpiCard
              label="Acervo"
              value={formatInt(kpis.midias_acervo)}
              hint="Mídias cadastradas"
            />
          </section>

          {destaques.length ? (
            <section className="rounded-xl border border-border bg-surface p-4">
              <h2 className="text-sm font-semibold text-foreground">Destaques</h2>
              <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {destaques.map((d) => (
                  <li key={d.id} className="rounded-lg bg-muted/40 px-3 py-2.5">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      {d.titulo}
                    </p>
                    <p className="mt-0.5 text-sm font-semibold text-foreground">{d.valor}</p>
                    {d.detalhe ? (
                      <p className="mt-0.5 text-xs text-muted-foreground">{d.detalhe}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-xl border border-border bg-surface p-4">
              <h2 className="text-sm font-semibold text-foreground">Produção no período</h2>
              <p className="text-xs text-muted-foreground">Artes geradas · conversas</p>
              <div className="mt-4 flex h-40 items-end gap-1 overflow-x-auto">
                {evolucao.map((t) => {
                  const hC = Math.round(((Number(t.conteudos_gerados) || 0) / maxEvo) * 100);
                  const hV = Math.round(((Number(t.conversas) || 0) / maxEvo) * 100);
                  return (
                    <div
                      key={t.day}
                      className="flex min-w-[26px] flex-1 flex-col items-center justify-end gap-0.5"
                      title={`${t.day}: ${t.conteudos_gerados} artes, ${t.conversas} conversas`}
                    >
                      <div className="flex h-32 w-full items-end justify-center gap-0.5">
                        <div
                          className="w-2 rounded-t bg-accent"
                          style={{ height: `${Math.max(hC, t.conteudos_gerados ? 4 : 0)}%` }}
                        />
                        <div
                          className="w-2 rounded-t bg-foreground/70"
                          style={{ height: `${Math.max(hV, t.conversas ? 4 : 0)}%` }}
                        />
                      </div>
                      <span className="text-[9px] text-muted-foreground">{formatDay(t.day)}</span>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="rounded-xl border border-border bg-surface p-4">
              <h2 className="text-sm font-semibold text-foreground">Criações recentes</h2>
              <p className="text-xs text-muted-foreground">Últimas artes do período</p>
              {criacoes.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">Nenhuma arte gerada no período.</p>
              ) : (
                <ul className="mt-3 divide-y divide-border">
                  {criacoes.slice(0, 6).map((item) => (
                    <li key={item.id_midia} className="flex items-center gap-3 py-2.5">
                      {item.url_arquivo ? (
                        <img
                          src={item.url_arquivo}
                          alt=""
                          className="h-10 w-10 shrink-0 rounded-md object-cover"
                        />
                      ) : (
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted text-[10px] text-muted-foreground">
                          —
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">{item.nome}</p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {item.criado_por}
                        </p>
                      </div>
                      <time className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                        {formatDate(item.data_criacao)}
                      </time>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      ) : null}
    </div>
  );
}
