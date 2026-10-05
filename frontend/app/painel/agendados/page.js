"use client";

import { useCallback, useEffect, useState } from "react";
import { authApiFetchWithToken, formatAuthError } from "../../../lib/auth";
import { idEmpresaUltimaFromMinhasPayload, resolveEmpresaAtivaId } from "../../../lib/empresaAtiva";
import {
  formatarDataAgendamento,
  infoStatusAgendamento,
  ordenarAgendamentos,
  podeCancelarAgendamento,
} from "../../../lib/agendamentos";

const ATUALIZA_A_CADA_MS = 30_000;

export default function AgendadosPage() {
  const [empresaId, setEmpresaId] = useState(null);
  const [itens, setItens] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [msg, setMsg] = useState("");
  const [cancelandoId, setCancelandoId] = useState(null);

  const carregar = useCallback(async (idEmpresa) => {
    const r = await authApiFetchWithToken(`/ia/agendamentos?id_empresa=${encodeURIComponent(idEmpresa)}`);
    if (!r.ok || r.networkError) {
      setMsg(r.networkError?.message || formatAuthError(r.json) || "Não foi possível carregar os agendamentos.");
      return;
    }
    setMsg("");
    setItens(Array.isArray(r.json?.agendamentos) ? r.json.agendamentos : []);
  }, []);

  useEffect(() => {
    let ativo = true;
    (async () => {
      const minhas = await authApiFetchWithToken("/empresas/minhas");
      if (!ativo) return;
      if (!minhas.ok || minhas.networkError) {
        setMsg(minhas.networkError?.message || formatAuthError(minhas.json) || "Falha ao carregar a empresa.");
        setCarregando(false);
        return;
      }
      const lista = Array.isArray(minhas.json?.empresas) ? minhas.json.empresas : [];
      const id = resolveEmpresaAtivaId(lista, {
        idEmpresaUltimaPerfil: idEmpresaUltimaFromMinhasPayload(minhas.json),
      });
      setEmpresaId(id);
      if (id) await carregar(id);
      if (ativo) setCarregando(false);
    })();
    return () => {
      ativo = false;
    };
  }, [carregar]);

  useEffect(() => {
    if (!empresaId) return undefined;
    const timer = setInterval(() => void carregar(empresaId), ATUALIZA_A_CADA_MS);
    return () => clearInterval(timer);
  }, [empresaId, carregar]);

  async function cancelar(item) {
    if (!empresaId || cancelandoId) return;
    if (!window.confirm("Cancelar este post agendado?")) return;
    setCancelandoId(item.id_publicacao_agendada);
    const r = await authApiFetchWithToken(`/ia/agendamentos/${item.id_publicacao_agendada}/cancelar`, {
      method: "POST",
      body: JSON.stringify({ id_empresa: empresaId }),
    });
    setCancelandoId(null);
    if (!r.ok || r.networkError) {
      setMsg(r.networkError?.message || (typeof r.json?.error === "string" ? r.json.error : null) || "Não foi possível cancelar.");
    }
    await carregar(empresaId);
  }

  const ordenados = ordenarAgendamentos(itens);

  return (
    <main className="rounded-xl border border-border bg-background p-6 transition-colors">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Agendados</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Posts do Instagram marcados para sair depois. Para agendar, aprove a legenda no chat e clique em Agendar.
        </p>
      </div>

      {msg ? <p className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">{msg}</p> : null}

      <div className="mt-6 space-y-3">
        {carregando ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : !empresaId ? (
          <p className="text-sm text-muted-foreground">Cadastre uma empresa para agendar posts.</p>
        ) : ordenados.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum post agendado ainda.</p>
        ) : (
          ordenados.map((item) => {
            const status = infoStatusAgendamento(item.status);
            return (
              <article
                key={item.id_publicacao_agendada}
                className="flex gap-3 rounded-lg border border-border bg-background px-3 py-3"
              >
                {item.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element -- URL pública do Storage; sem domínio fixo para o next/image
                  <img src={item.image_url} alt="" className="h-20 w-20 shrink-0 rounded-md border border-border object-cover" />
                ) : (
                  <div className="h-20 w-20 shrink-0 rounded-md border border-border bg-muted" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-md border px-2 py-0.5 text-xs font-semibold ${status.classe}`}>{status.rotulo}</span>
                    <span className="text-sm font-medium text-foreground">{formatarDataAgendamento(item.agendada_para)}</span>
                  </div>
                  <p className="mt-1 line-clamp-2 whitespace-pre-wrap break-words text-sm text-muted-foreground">{item.legenda}</p>
                  {item.status === "falhou" && item.erro ? (
                    <p className="mt-1 text-xs text-red-600 dark:text-red-400">{item.erro}</p>
                  ) : null}
                  {podeCancelarAgendamento(item.status) ? (
                    <button
                      type="button"
                      disabled={cancelandoId === item.id_publicacao_agendada}
                      onClick={() => void cancelar(item)}
                      className="mt-2 rounded-lg border border-border bg-background px-3 py-1 text-xs font-semibold text-foreground shadow-sm hover:bg-muted disabled:opacity-50"
                    >
                      {cancelandoId === item.id_publicacao_agendada ? "Cancelando…" : "Cancelar"}
                    </button>
                  ) : null}
                </div>
              </article>
            );
          })
        )}
      </div>
    </main>
  );
}
