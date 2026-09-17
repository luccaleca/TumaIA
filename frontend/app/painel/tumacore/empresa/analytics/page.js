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

function formatDay(ymd) {
  if (!ymd || String(ymd).length < 10) return String(ymd || "—");
  const [y, m, d] = String(ymd).split("-");
  return `${d}/${m}`;
}

function DeltaLine({ label, current, delta }) {
  const d = Number(delta);
  const deltaClass =
    Number.isFinite(d) && d !== 0
      ? d > 0
        ? "text-emerald-700"
        : "text-red-700"
      : "text-muted-foreground";
  return (
    <li className="flex items-baseline justify-between gap-3 border-b border-border py-2 last:border-0">
      <span className="text-sm text-foreground">{label}</span>
      <span className="text-right">
        <span className="tabular-nums text-sm font-semibold text-foreground">
          {formatInt(current)}
        </span>
        <span className={`ml-2 text-xs tabular-nums ${deltaClass}`}>{formatDelta(delta)}</span>
      </span>
    </li>
  );
}

function BarList({ rows, max }) {
  const m = Math.max(1, Number(max) || 1);
  return (
    <ul className="mt-3 space-y-3">
      {rows.map((row) => {
        const pct = Math.round(((Number(row.total) || 0) / m) * 100);
        return (
          <li key={row.key}>
            <div className="mb-1 flex justify-between gap-2 text-xs">
              <span className="truncate text-foreground">{row.label}</span>
              <span className="tabular-nums font-medium text-foreground">
                {formatInt(row.total)}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-foreground/70"
                style={{ width: `${Math.max(pct, row.total ? 4 : 0)}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
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

  const producao = data?.producao || {};
  const uso = data?.uso || {};
  const empresa = data?.empresa_detalhe || {};
  const tendenciaUso = Array.isArray(uso.tendencia) ? uso.tendencia : [];
  const heatmap = Array.isArray(uso.heatmap) ? uso.heatmap : [];
  const membros = Array.isArray(empresa.membros_mais_ativos) ? empresa.membros_mais_ativos : [];

  const maxTrendUso = useMemo(() => {
    let m = 1;
    for (const t of tendenciaUso) {
      m = Math.max(
        m,
        Number(t.mensagens_usuario) || 0,
        Number(t.mensagens_assistente) || 0,
      );
    }
    return m;
  }, [tendenciaUso]);

  const maxHeat = useMemo(() => {
    let m = 1;
    for (const row of heatmap) {
      for (const cell of row || []) m = Math.max(m, Number(cell) || 0);
    }
    return m;
  }, [heatmap]);

  const maxMembro = useMemo(() => {
    let m = 1;
    for (const row of membros) {
      m = Math.max(m, Number(row.conversas) || 0, Number(row.conteudos_gerados) || 0);
    }
    return m;
  }, [membros]);

  const maxTipo = useMemo(() => {
    const rows = Array.isArray(uso.tipos_solicitacao) ? uso.tipos_solicitacao : [];
    return Math.max(1, ...rows.map((r) => Number(r.total) || 0));
  }, [uso.tipos_solicitacao]);

  const maxOrigem = useMemo(() => {
    const rows = Array.isArray(producao.por_origem) ? producao.por_origem : [];
    return Math.max(1, ...rows.map((r) => Number(r.total) || 0));
  }, [producao.por_origem]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Analytics</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Detalhe do uso em {data?.empresa?.nome_fantasia || "sua empresa"}
            {data?.range?.label ? ` · ${data.range.label}` : ""}
            {data?.previous?.label ? ` · vs ${data.previous.label}` : ""}.
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
          <section className="rounded-xl border border-border bg-surface p-4">
            <h2 className="text-sm font-semibold text-foreground">Comparativo do período</h2>
            <p className="text-xs text-muted-foreground">Variação em relação ao intervalo anterior</p>
            <ul className="mt-2 max-w-lg">
              <DeltaLine
                label="Artes geradas"
                current={producao.conteudos_gerados}
                delta={producao.delta?.conteudos_gerados}
              />
              <DeltaLine
                label="Conversas"
                current={uso.conversas}
                delta={uso.delta?.conversas}
              />
              <DeltaLine
                label="Msgs do time"
                current={uso.mensagens_usuario}
                delta={uso.delta?.mensagens_usuario}
              />
              <DeltaLine
                label="Respostas do Tuma"
                current={uso.mensagens_assistente}
                delta={uso.delta?.mensagens_assistente}
              />
              <DeltaLine
                label="Acervo no período"
                current={producao.midias_acervo_periodo}
                delta={producao.delta?.midias_acervo_periodo}
              />
            </ul>
          </section>

          <section className="space-y-3">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Produção</h2>
              <p className="text-xs text-muted-foreground">
                De onde vieram as mídias ·{" "}
                {formatInt(producao.frequencia?.percentual)}% dos dias com uso
              </p>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <article className="rounded-xl border border-border bg-surface p-4">
                <h3 className="text-sm font-semibold text-foreground">Origem das mídias</h3>
                {(producao.por_origem || []).length === 0 ? (
                  <p className="mt-4 text-sm text-muted-foreground">Sem mídias no período.</p>
                ) : (
                  <BarList
                    max={maxOrigem}
                    rows={(producao.por_origem || []).map((r) => ({
                      key: r.origem,
                      label: r.label,
                      total: r.total,
                    }))}
                  />
                )}
                <p className="mt-4 text-xs text-muted-foreground">
                  Acervo total da empresa: {formatInt(producao.midias_acervo_total)}
                </p>
              </article>
              <article className="rounded-xl border border-border bg-surface p-4">
                <h3 className="text-sm font-semibold text-foreground">Tipos de resposta</h3>
                <p className="text-xs text-muted-foreground">Com ou sem imagem na resposta</p>
                {(uso.tipos_solicitacao || []).length === 0 ? (
                  <p className="mt-4 text-sm text-muted-foreground">Sem respostas no período.</p>
                ) : (
                  <BarList
                    max={maxTipo}
                    rows={(uso.tipos_solicitacao || []).map((r) => ({
                      key: r.tipo,
                      label: r.label,
                      total: r.total,
                    }))}
                  />
                )}
              </article>
            </div>
          </section>

          <section className="space-y-3">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Uso do TumaIA</h2>
              <p className="text-xs text-muted-foreground">Quando e como o time conversa</p>
            </div>
            <article className="rounded-xl border border-border bg-surface p-4">
              <h3 className="text-sm font-semibold text-foreground">Mensagens por dia</h3>
              <div className="mt-4 flex h-36 items-end gap-1 overflow-x-auto">
                {tendenciaUso.map((t) => {
                  const hU = Math.round(((Number(t.mensagens_usuario) || 0) / maxTrendUso) * 100);
                  const hA = Math.round(((Number(t.mensagens_assistente) || 0) / maxTrendUso) * 100);
                  return (
                    <div
                      key={t.day}
                      className="flex min-w-[26px] flex-1 flex-col items-center justify-end gap-0.5"
                      title={`${t.day}: time ${t.mensagens_usuario}, Tuma ${t.mensagens_assistente}`}
                    >
                      <div className="flex h-28 w-full items-end justify-center gap-0.5">
                        <div
                          className="w-2 rounded-t bg-foreground/80"
                          style={{ height: `${Math.max(hU, t.mensagens_usuario ? 4 : 0)}%` }}
                        />
                        <div
                          className="w-2 rounded-t bg-slate-400"
                          style={{ height: `${Math.max(hA, t.mensagens_assistente ? 4 : 0)}%` }}
                        />
                      </div>
                      <span className="text-[9px] text-muted-foreground">{formatDay(t.day)}</span>
                    </div>
                  );
                })}
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Escuro = time · claro = Tuma
              </p>
            </article>
            <article className="rounded-xl border border-border bg-surface p-4">
              <h3 className="text-sm font-semibold text-foreground">Horários de uso</h3>
              <p className="text-xs text-muted-foreground">Msgs do time · dia × hora (Brasília)</p>
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
            </article>
          </section>

          <section className="space-y-3">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Empresa</h2>
              <p className="text-xs text-muted-foreground">
                {formatInt(empresa.membros)} membros · {formatInt(empresa.membros_ativos_periodo)}{" "}
                ativos no período · {formatInt(empresa.midias_cadastradas)} no acervo
              </p>
            </div>
            <article className="rounded-xl border border-border bg-surface p-4">
              <h3 className="text-sm font-semibold text-foreground">Membros mais ativos</h3>
              {membros.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">
                  Sem atividade de membros no período.
                </p>
              ) : (
                <ul className="mt-3 divide-y divide-border">
                  {membros.map((m) => {
                    const score = Math.max(
                      Number(m.conversas) || 0,
                      Number(m.conteudos_gerados) || 0,
                    );
                    const pct = Math.round((score / maxMembro) * 100);
                    return (
                      <li key={m.id_usuario} className="py-2.5">
                        <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
                          <div>
                            <p className="text-sm font-medium text-foreground">{m.nome}</p>
                            {m.email ? (
                              <p className="text-[11px] text-muted-foreground">{m.email}</p>
                            ) : null}
                          </div>
                          <p className="text-xs tabular-nums text-muted-foreground">
                            {formatInt(m.conversas)} conversas · {formatInt(m.conteudos_gerados)}{" "}
                            artes
                          </p>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-foreground/70"
                            style={{ width: `${Math.max(pct, score ? 4 : 0)}%` }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </article>
          </section>

          <p className="text-xs text-muted-foreground">
            Aprovação, publicação no Instagram, créditos e playbooks ainda não ficam registrados
            de forma consultável no TumaIA.
          </p>
        </>
      ) : null}
    </div>
  );
}
