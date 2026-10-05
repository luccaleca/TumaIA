/** Textos e regras da tela «Agendados» (posts do Instagram marcados para depois). */

export const STATUS_AGENDAMENTO = {
  agendado: { rotulo: "Agendado", classe: "border-accent/40 bg-accent-muted text-[#009638] dark:text-emerald-100" },
  publicando: { rotulo: "Publicando…", classe: "border-amber-500/40 bg-amber-500/10 text-foreground" },
  publicado: { rotulo: "Publicado", classe: "border-emerald-600/40 bg-emerald-600/10 text-foreground" },
  falhou: { rotulo: "Falhou", classe: "border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400" },
  cancelado: { rotulo: "Cancelado", classe: "border-border bg-muted text-muted-foreground" },
};

/** @param {string} status */
export function infoStatusAgendamento(status) {
  return STATUS_AGENDAMENTO[status] ?? { rotulo: String(status || "—"), classe: "border-border bg-muted text-muted-foreground" };
}

/** Só dá para cancelar o que ainda não começou a publicar. */
export function podeCancelarAgendamento(status) {
  return status === "agendado";
}

/** Data e hora no fuso do navegador, ex.: «06/10/2026 18:30». */
export function formatarDataAgendamento(iso) {
  const d = new Date(String(iso ?? ""));
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

/** O que aparece antes do filtro: o próximo a publicar primeiro, depois o histórico (mais recente primeiro). */
export function ordenarAgendamentos(lista) {
  const itens = Array.isArray(lista) ? lista : [];
  const proximos = itens
    .filter((a) => a.status === "agendado" || a.status === "publicando")
    .sort((a, b) => new Date(a.agendada_para) - new Date(b.agendada_para));
  const historico = itens
    .filter((a) => a.status !== "agendado" && a.status !== "publicando")
    .sort((a, b) => new Date(b.agendada_para) - new Date(a.agendada_para));
  return [...proximos, ...historico];
}
