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
  const fluxo = data?.fluxo || {};

  const maxEvo = useMemo(() => {
    let m = 1;
    for (const t of evolucao) {
      m = Math.max(
        m,
        Number(t.mensagens_usuario) || 0,
        Number(t.mensagens_assistente) || 0,
        Number(t.midias) || 0,
      );
    }
    return m;
  }, [evolucao]);

  const maxFluxo = Math.max(
    1,
    Number(fluxo.mensagens_usuario) || 0,
    Number(fluxo.mensagens_assistente) || 0,
    Number(fluxo.midias) || 0,
    Number(fluxo.conversas) || 0,
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {empresa.nome_fantasia || "Sua empresa"}
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
            <KpiCard label="Membros" value={formatInt(kpis.membros)} hint={empresa.segmento || undefined} />
            <KpiCard
              label="Msgs usuário"
              value={formatInt(kpis.mensagens_usuario_periodo)}
              hint={`${formatInt(kpis.conversas_periodo)} conversas`}
            />
            <KpiCard
              label="Msgs assistente"
              value={formatInt(kpis.mensagens_assistente_periodo)}
            />
            <KpiCard
              label="Mídias"
              value={formatInt(kpis.midias_total)}
              hint={`${formatInt(kpis.midias_periodo)} novas no período`}
            />
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-xl border border-border bg-surface p-4">
              <h2 className="text-sm font-semibold text-foreground">Evolução</h2>
              <p className="text-xs text-muted-foreground">
                Msgs user · assistente · mídias por dia
              </p>
              <div className="mt-4 flex h-40 items-end gap-1 overflow-x-auto">
                {evolucao.map((t) => {
                  const hU = Math.round(((Number(t.mensagens_usuario) || 0) / maxEvo) * 100);
                  const hA = Math.round(((Number(t.mensagens_assistente) || 0) / maxEvo) * 100);
                  const hM = Math.round(((Number(t.midias) || 0) / maxEvo) * 100);
                  return (
                    <div
                      key={t.day}
                      className="flex min-w-[26px] flex-1 flex-col items-center justify-end gap-0.5"
                      title={`${t.day}: user ${t.mensagens_usuario}, asst ${t.mensagens_assistente}, midias ${t.midias}`}
                    >
                      <div className="flex h-32 w-full items-end justify-center gap-0.5">
                        <div
                          className="w-1.5 rounded-t bg-foreground/80"
                          style={{ height: `${Math.max(hU, t.mensagens_usuario ? 4 : 0)}%` }}
                        />
                        <div
                          className="w-1.5 rounded-t bg-slate-400"
                          style={{ height: `${Math.max(hA, t.mensagens_assistente ? 4 : 0)}%` }}
                        />
                        <div
                          className="w-1.5 rounded-t bg-accent"
                          style={{ height: `${Math.max(hM, t.midias ? 4 : 0)}%` }}
                        />
                      </div>
                      <span className="text-[9px] text-muted-foreground">
                        {String(t.day).slice(8)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="rounded-xl border border-border bg-surface p-4">
              <h2 className="text-sm font-semibold text-foreground">Fluxo no período</h2>
              <ul className="mt-4 space-y-3">
                {[
                  { label: "Mensagens usuário", value: fluxo.mensagens_usuario },
                  { label: "Mensagens assistente", value: fluxo.mensagens_assistente },
                  { label: "Mídias novas", value: fluxo.midias },
                  { label: "Conversas", value: fluxo.conversas },
                ].map((row) => {
                  const pct = Math.round(((Number(row.value) || 0) / maxFluxo) * 100);
                  return (
                    <li key={row.label}>
                      <div className="mb-1 flex justify-between text-xs">
                        <span>{row.label}</span>
                        <span className="tabular-nums font-medium">{formatInt(row.value)}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-foreground/70"
                          style={{ width: `${Math.max(pct, row.value ? 4 : 0)}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          </div>
        </>
      ) : null}
    </div>
  );
}
