"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { authApiFetchWithToken } from "../../../../../lib/auth";
import PlataformaPeriodFilter, {
  plataformaRangeQuery,
} from "../../PlataformaPeriodFilter";

const DOW = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function formatInt(n) {
  return Number(n || 0).toLocaleString("pt-BR");
}

function formatDelta(n) {
  const v = Number(n) || 0;
  const sign = v > 0 ? "+" : "";
  return `${sign}${v}%`;
}

function KpiCard({ label, value, delta }) {
  const d = Number(delta);
  const deltaClass =
    Number.isFinite(d) && d !== 0
      ? d > 0
        ? "text-emerald-700"
        : "text-red-700"
      : "text-muted-foreground";
  return (
    <article className="rounded-xl border border-border bg-surface p-4">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{value}</p>
      {delta !== undefined ? (
        <p className={`mt-1 text-xs tabular-nums ${deltaClass}`}>
          {formatDelta(delta)} vs período anterior
        </p>
      ) : null}
    </article>
  );
}

export default function TumaCoreEmpresaAnalyticsPage() {
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
    const r = await authApiFetchWithToken(`/tumacore/empresa/analytics?${qs}`);
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

  const maxTrend = useMemo(() => {
    const trend = Array.isArray(data?.trend) ? data.trend : [];
    let m = 1;
    for (const t of trend) {
      m = Math.max(m, Number(t.mensagens_usuario) || 0, Number(t.midias) || 0);
    }
    return m;
  }, [data]);

  const maxHeat = useMemo(() => {
    const heat = Array.isArray(data?.heatmap) ? data.heatmap : [];
    let m = 1;
    for (const row of heat) {
      for (const cell of row || []) m = Math.max(m, Number(cell) || 0);
    }
    return m;
  }, [data]);

  const kpis = data?.kpis || {};
  const empresa = data?.empresa || {};
  const trend = Array.isArray(data?.trend) ? data.trend : [];
  const heatmap = Array.isArray(data?.heatmap) ? data.heatmap : [];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Analytics</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Uso de {empresa.nome_fantasia || "sua empresa"}
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
        <p className="text-sm text-muted-foreground">Carregando analytics…</p>
      ) : null}

      {data ? (
        <>
          <section className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <KpiCard
              label="Msgs usuário"
              value={formatInt(kpis.mensagens_usuario)}
              delta={kpis.delta?.mensagens_usuario}
            />
            <KpiCard
              label="Mídias novas"
              value={formatInt(kpis.midias)}
              delta={kpis.delta?.midias}
            />
            <KpiCard
              label="Conversas"
              value={formatInt(kpis.conversas)}
              delta={kpis.delta?.conversas}
            />
          </section>

          <section className="rounded-xl border border-border bg-surface p-4">
            <h2 className="text-sm font-semibold text-foreground">Tendência diária</h2>
            <p className="text-xs text-muted-foreground">Barras: mensagens (escuro) e mídias (claro)</p>
            <div className="mt-4 flex h-40 items-end gap-1 overflow-x-auto">
              {trend.map((t) => {
                const hMsg = Math.round(((Number(t.mensagens_usuario) || 0) / maxTrend) * 100);
                const hMid = Math.round(((Number(t.midias) || 0) / maxTrend) * 100);
                return (
                  <div
                    key={t.day}
                    className="flex min-w-[28px] flex-1 flex-col items-center justify-end gap-0.5"
                    title={`${t.day}: ${t.mensagens_usuario} msgs, ${t.midias} mídias`}
                  >
                    <div className="flex h-32 w-full items-end justify-center gap-0.5">
                      <div
                        className="w-2 rounded-t bg-foreground/80"
                        style={{ height: `${Math.max(hMsg, t.mensagens_usuario ? 4 : 0)}%` }}
                      />
                      <div
                        className="w-2 rounded-t bg-accent"
                        style={{ height: `${Math.max(hMid, t.midias ? 4 : 0)}%` }}
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
            <h2 className="text-sm font-semibold text-foreground">Heatmap (msgs user)</h2>
            <p className="text-xs text-muted-foreground">Dia da semana × hora (Brasília)</p>
            <div className="mt-3 overflow-x-auto">
              <div className="inline-grid grid-cols-[auto_repeat(24,minmax(10px,1fr))] gap-0.5">
                <div />
                {Array.from({ length: 24 }, (_, h) => (
                  <div key={h} className="text-center text-[8px] text-muted-foreground">
                    {h}
                  </div>
                ))}
                {heatmap.map((row, dow) => (
                  <div key={`row-${dow}`} className="contents">
                    <div className="pr-1 text-right text-[10px] text-muted-foreground">
                      {DOW[dow]}
                    </div>
                    {(row || []).map((cell, hour) => {
                      const intensity = (Number(cell) || 0) / maxHeat;
                      return (
                        <div
                          key={`${dow}-${hour}`}
                          title={`${DOW[dow]} ${hour}h: ${cell}`}
                          className="h-3 w-full rounded-[2px]"
                          style={{
                            backgroundColor: `rgba(15, 23, 42, ${0.08 + intensity * 0.85})`,
                          }}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
