"use client";

import { PILARES_COMPLETUDE, buildLeisMarcaPreview } from "../../../lib/identidadeMarcaUi";

function coletarCores(dados) {
  const cores = [];
  for (const hex of [dados.cor_primaria, dados.cor_secundaria, ...(dados.cores_adicionais || [])]) {
    const v = String(hex || "").trim();
    if (!v || cores.includes(v)) continue;
    cores.push(v);
  }
  return cores;
}

function resolveLogoUrl(dados, midias) {
  const id = String(dados.id_midia_logo ?? "").trim();
  if (!id) return "";
  const midia = midias.find((m) => String(m.id_midia) === id);
  return midia?.url_arquivo ? String(midia.url_arquivo) : "";
}

export default function IdentidadeMarcaResumo({
  dados,
  midias,
  percentual,
  prontoParaImagem,
  loading = false,
  nomeFantasia = "",
}) {
  if (loading) {
    return (
      <div className="animate-pulse space-y-4 px-4 py-4 sm:px-5">
        <div className="flex gap-4">
          <div className="h-20 w-20 rounded-xl bg-muted" />
          <div className="flex flex-1 flex-col gap-2 pt-1">
            <div className="h-3 w-2/3 rounded bg-muted" />
            <div className="h-2 w-full rounded bg-muted" />
          </div>
        </div>
      </div>
    );
  }

  const cores = coletarCores(dados);
  const logoUrl = resolveLogoUrl(dados, midias);
  const pct = Math.min(100, Math.max(0, Number(percentual) || 0));
  const preview = buildLeisMarcaPreview(dados, { nome_fantasia: nomeFantasia });
  const papel = String(dados.papel_agente || "").trim();
  const temAlgo = Boolean(logoUrl || cores.length || papel || String(dados.estilo_visual || "").trim());

  if (!temAlgo) {
    return (
      <div className="px-4 py-6 sm:px-5">
        <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-8 text-center">
          <p className="text-sm font-medium text-foreground">Ainda vazio</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Coloque a logo, as cores e escreva no papel como a marca é — o agente usa isso nas artes.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 px-4 py-4 sm:px-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div
          className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted/30"
          style={
            logoUrl
              ? {
                  backgroundImage:
                    "linear-gradient(45deg,#e2e8f0 25%,transparent 25%),linear-gradient(-45deg,#e2e8f0 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#e2e8f0 75%),linear-gradient(-45deg,transparent 75%,#e2e8f0 75%)",
                  backgroundSize: "10px 10px",
                  backgroundPosition: "0 0, 0 5px, 5px -5px, -5px 0",
                }
              : undefined
          }
        >
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="Logo" className="max-h-full max-w-full object-contain p-1.5" />
          ) : (
            <span className="px-2 text-center text-[11px] text-muted-foreground">Sem logo</span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {preview.titulo}
            </p>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold tabular-nums text-foreground">{pct}%</span>
              {prontoParaImagem ? (
                <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-medium text-accent ring-1 ring-accent/25">
                  Pronto
                </span>
              ) : null}
            </div>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${pct}%` }} />
          </div>
          {cores.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {cores.map((hex) => (
                <span
                  key={hex}
                  title={hex}
                  className="h-8 w-8 rounded-full ring-1 ring-black/10 dark:ring-white/15"
                  style={{ backgroundColor: hex }}
                />
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {papel ? (
        <div className="rounded-xl border border-border bg-[#FBF9F4] px-4 py-3 dark:bg-[#1a1814]">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Papel</p>
          <p className="mt-1 whitespace-pre-wrap font-serif text-sm leading-relaxed text-foreground">
            {papel.length > 320 ? `${papel.slice(0, 319)}…` : papel}
          </p>
        </div>
      ) : null}

      <ul className="flex flex-wrap gap-1.5 border-t border-border pt-3">
        {PILARES_COMPLETUDE.map(({ key, label, obrigatorio }) => {
          const ok =
            key === "estilo_visual"
              ? Boolean(String(dados.estilo_visual || "").trim()) ||
                Boolean(String(dados.assinatura_visual || "").trim()) ||
                String(dados.papel_agente || "").trim().length >= 40
              : key === "papel_agente"
                ? String(dados.papel_agente || "").trim().length >= 40
                : Boolean(String(dados[key] ?? "").trim());
          return (
            <li
              key={key}
              className={`rounded-full px-2 py-0.5 text-[11px] ${
                ok
                  ? "bg-accent/15 text-foreground ring-1 ring-accent/20"
                  : obrigatorio
                    ? "bg-muted text-muted-foreground"
                    : "bg-muted/60 text-muted-foreground"
              }`}
            >
              {ok ? "✓ " : ""}
              {label}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
