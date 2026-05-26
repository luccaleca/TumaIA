"use client";

import { PILARES_COMPLETUDE, PILAR_LOGO } from "../../../lib/identidadeMarcaUi";

const CAMPO_RESUMO = [
  { key: "estilo_visual", label: "Estilo visual" },
  { key: "assinatura_visual", label: "Assinatura visual" },
  { key: "variacoes_campanha", label: "Variações por campanha" },
  { key: "regras_repeticao", label: "Regras de repetição" },
  { key: "estrategia_cor_campanha", label: "Estratégia de cor" },
  { key: "tom_voz", label: "Mood / atmosfera" },
  { key: "evitar", label: "Evitar nas artes" },
  { key: "publico", label: "Público-alvo" },
  { key: "segmento", label: "Segmento" },
  { key: "sobre_empresa", label: "Sobre a empresa" },
];

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

function camposPreenchidos(dados) {
  return CAMPO_RESUMO.filter(({ key }) => String(dados[key] ?? "").trim());
}

export default function IdentidadeMarcaResumo({
  dados,
  midias,
  percentual,
  prontoParaImagem,
  loading = false,
}) {
  if (loading) {
    return (
      <div className="animate-pulse space-y-4 px-4 py-4 sm:px-5">
        <div className="flex gap-4">
          <div className="h-20 w-20 rounded-xl bg-muted" />
          <div className="flex flex-1 flex-col gap-2 pt-1">
            <div className="h-3 w-2/3 rounded bg-muted" />
            <div className="h-2 w-full rounded bg-muted" />
            <div className="mt-2 flex gap-2">
              <div className="h-8 w-8 rounded-full bg-muted" />
              <div className="h-8 w-8 rounded-full bg-muted" />
              <div className="h-8 w-8 rounded-full bg-muted" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  const cores = coletarCores(dados);
  const logoUrl = resolveLogoUrl(dados, midias);
  const preenchidos = camposPreenchidos(dados);
  const pct = Math.min(100, Math.max(0, Number(percentual) || 0));
  const temAlgo = Boolean(logoUrl || cores.length || preenchidos.length);

  const pilares = [
    ...PILARES_COMPLETUDE.map(({ key, label }) => ({
      key,
      label,
      ok: Boolean(String(dados[key] ?? "").trim()),
    })),
    {
      key: PILAR_LOGO.key,
      label: PILAR_LOGO.label,
      ok: Boolean(String(dados[PILAR_LOGO.key] ?? "").trim()),
    },
  ];

  if (!temAlgo) {
    return (
      <div className="px-4 py-6 sm:px-5">
        <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-8 text-center">
          <p className="text-sm font-medium text-foreground">Identidade ainda não configurada</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Envie fotos ou preencha manualmente para o Tuma entender cores, estilo e tom da sua empresa nas artes.
          </p>
        </div>
      </div>
    );
  }

  const sobre =
    preenchidos.find((c) => c.key === "assinatura_visual") || preenchidos.find((c) => c.key === "estilo_visual");
  const demais = preenchidos.filter((c) => c.key !== sobre?.key);

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
            <img src={logoUrl} alt="Logo da empresa" className="max-h-full max-w-full object-contain p-1.5" />
          ) : (
            <span className="px-2 text-center text-[11px] text-muted-foreground">Sem logo</span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Como o Tuma entende sua empresa
            </p>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold tabular-nums text-foreground">{pct}%</span>
              {prontoParaImagem ? (
                <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-medium text-accent ring-1 ring-accent/25">
                  Pronta para artes
                </span>
              ) : null}
            </div>
          </div>

          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${pct}%` }} />
          </div>

          {cores.length ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">Cores</span>
              {cores.map((hex) => (
                <span
                  key={hex}
                  title={hex}
                  className="h-8 w-8 rounded-full ring-1 ring-black/10 dark:ring-white/15"
                  style={{ backgroundColor: hex }}
                />
              ))}
            </div>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">Cores ainda não definidas</p>
          )}
        </div>
      </div>

      {sobre ? (
        <div className="rounded-xl border border-border bg-muted/15 p-3 sm:p-4">
          <p className="text-xs font-medium text-muted-foreground">{sobre.label}</p>
          <p className="mt-1 text-sm leading-relaxed text-foreground">{String(dados[sobre.key] ?? "").trim()}</p>
        </div>
      ) : null}

      {demais.length ? (
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {demais.map(({ key, label }) => (
            <div key={key} className="rounded-lg border border-border/80 bg-background/60 px-3 py-2.5">
              <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
              <dd className="mt-1 text-sm text-foreground">{String(dados[key] ?? "").trim()}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      <ul className="flex flex-wrap gap-1.5 border-t border-border pt-3">
        {pilares.map(({ key, label, ok }) => (
          <li
            key={key}
            className={`rounded-full px-2 py-0.5 text-[11px] ${
              ok ? "bg-accent/15 text-foreground ring-1 ring-accent/20" : "bg-muted text-muted-foreground"
            }`}
          >
            {ok ? "✓ " : ""}
            {label}
          </li>
        ))}
      </ul>
    </div>
  );
}
