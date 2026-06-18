"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { authApiFetchWithToken, formatAuthError } from "../../../lib/auth";
import {
  empresaRowFromMinhas,
  idEmpresaUltimaFromMinhasPayload,
  resolveEmpresaAtivaId,
  setEmpresaAtiva,
} from "../../../lib/empresaAtiva";

function cargoPodeGerenciar(papel) {
  return papel === "administrador" || papel === "editor";
}

function ModeloToggle({ ativo, disabled, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={ativo}
      aria-label={label}
      disabled={disabled}
      onClick={(ev) => {
        ev.stopPropagation();
        if (!disabled) onChange(!ativo);
      }}
      className={[
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors",
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
        ativo ? "border-accent bg-accent" : "border-border bg-muted",
      ].join(" ")}
    >
      <span
        className={[
          "inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform",
          ativo ? "translate-x-[18px]" : "translate-x-0.5",
        ].join(" ")}
      />
    </button>
  );
}

function modeloExemploFallback(slug) {
  const map = {
    promocao: "promocao",
    lancamento: "lancamento",
    produto: "produto",
    lifestyle: "produto",
    mensagens: "mensagens",
  };
  const file = map[String(slug || "").trim()] || "promocao";
  return `/imagens/modelos/${file}.svg`;
}

/** Força reload quando o PNG de exemplo é trocado mantendo o mesmo nome. */
const EXEMPLO_IMG_VERSION = {
  promocao: 2,
  lancamento: 2,
  produto: 2,
  mensagens: 2,
};

function exemploImagemSrc(url, slug) {
  const base = String(url || "").trim();
  if (!base) return base;
  const version = EXEMPLO_IMG_VERSION[String(slug || "").trim()];
  if (!version) return base;
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}v=${version}`;
}

function ModeloCard({ modelo, podeGerenciar, toggling, onOpen, onToggle }) {
  const imgFallback = modeloExemploFallback(modelo.slug);
  const [imgSrc, setImgSrc] = useState(() => exemploImagemSrc(modelo.exemplo_imagem_url, modelo.slug));

  useEffect(() => {
    setImgSrc(exemploImagemSrc(modelo.exemplo_imagem_url, modelo.slug));
  }, [modelo.exemplo_imagem_url, modelo.slug]);

  return (
    <article
      className="group flex cursor-pointer flex-col overflow-hidden rounded-lg border border-border bg-background shadow-sm transition-[border-color,box-shadow] hover:border-accent/40 hover:shadow-md"
      onClick={() => onOpen(modelo)}
    >
      <div className="relative aspect-[2/1] w-full overflow-hidden bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imgSrc}
          alt={`Exemplo visual — ${modelo.nome}`}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          onError={() => setImgSrc(imgFallback)}
        />
        {modelo.ativo ? (
          <span className="absolute left-2 top-2 rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white shadow">
            Ativo
          </span>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-2.5">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-foreground">{modelo.nome}</h3>
          <p className="mt-0.5 line-clamp-3 text-xs leading-snug text-muted-foreground">{modelo.tagline}</p>
        </div>
        <div
          className="mt-auto flex items-center justify-end gap-2 border-t border-border pt-2"
          onClick={(ev) => ev.stopPropagation()}
        >
          <ModeloToggle
            ativo={modelo.ativo}
            disabled={!podeGerenciar || toggling}
            label={`${modelo.ativo ? "Desativar" : "Ativar"} modelo ${modelo.nome}`}
            onChange={(next) => onToggle(modelo, next)}
          />
        </div>
      </div>
    </article>
  );
}

function IconClose() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

function ModeloExemploImagem({ src, alt, fallback, slug, className = "" }) {
  const [imgSrc, setImgSrc] = useState(() => exemploImagemSrc(src, slug));
  const [lightbox, setLightbox] = useState(false);

  useEffect(() => {
    setImgSrc(exemploImagemSrc(src, slug));
  }, [src, slug]);

  useEffect(() => {
    if (!lightbox) return;
    function onKeyDown(ev) {
      if (ev.key === "Escape") setLightbox(false);
    }
    document.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [lightbox]);

  return (
    <>
      <div className={["space-y-2", className].filter(Boolean).join(" ")}>
        <button
          type="button"
          onClick={() => setLightbox(true)}
          className="group/exemplo relative mx-auto block w-full max-w-xs cursor-zoom-in rounded-lg border border-border bg-muted p-2 text-left transition-[border-color,box-shadow] hover:border-accent/45 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
          aria-label={`Ampliar exemplo: ${alt}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imgSrc}
            alt={alt}
            className="mx-auto block h-auto max-h-[min(52vh,26rem)] w-full object-contain"
            onError={() => setImgSrc(fallback)}
          />
          <span className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center opacity-0 transition-opacity group-hover/exemplo:opacity-100 group-focus-visible/exemplo:opacity-100">
            <span className="rounded-full bg-black/65 px-2.5 py-1 text-[10px] font-medium text-white">
              Clique para ampliar
            </span>
          </span>
        </button>
      </div>

      {lightbox ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Exemplo ampliado">
          <button
            type="button"
            aria-label="Fechar visualização"
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => setLightbox(false)}
          />
          <div className="relative z-10 flex max-h-full max-w-full flex-col items-end gap-2">
            <button
              type="button"
              onClick={() => setLightbox(false)}
              aria-label="Fechar"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/20 bg-black/50 text-white hover:bg-black/70"
            >
              <IconClose />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imgSrc}
              alt={alt}
              className="max-h-[min(90vh,48rem)] max-w-full object-contain"
              onError={() => setImgSrc(fallback)}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}

function ModeloListaBullets({ titulo, itens }) {
  if (!Array.isArray(itens) || !itens.length) return null;
  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{titulo}</h3>
      <ul className="space-y-1.5">
        {itens.map((item) => (
          <li
            key={item}
            className="flex gap-2 rounded-lg border border-border bg-background px-2.5 py-2 text-xs leading-snug text-foreground"
          >
            <span className="mt-0.5 shrink-0 text-accent" aria-hidden>
              •
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ModeloDetalheSheet({ open, modelo, onClose, podeGerenciar, toggling, onToggle }) {
  useEffect(() => {
    if (!open) return;
    function onKeyDown(ev) {
      if (ev.key === "Escape") onClose?.();
    }
    document.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open || !modelo) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="modelo-detalhe-titulo">
      <button
        type="button"
        aria-label="Fechar detalhes do modelo"
        className="absolute inset-0 bg-black/35 backdrop-blur-[2px] transition-opacity dark:bg-black/50"
        onClick={onClose}
      />
      <section
        className="relative flex max-h-[min(92vh,44rem)] w-full flex-col overflow-hidden rounded-t-2xl border border-border bg-surface shadow-2xl sm:max-w-lg sm:rounded-2xl"
        onClick={(ev) => ev.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0 pr-2">
            <h2 id="modelo-detalhe-titulo" className="text-base font-semibold text-foreground">
              {modelo.nome}
            </h2>
            <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{modelo.tagline}</p>
            {modelo.descricao ? (
              <p className="mt-2 text-xs leading-relaxed text-foreground">{modelo.descricao}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <IconClose />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <div className="mb-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Exemplo de layout
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Veja onde entram sua logo, mídia e texto — o post final usa os dados do seu chat.
            </p>
          </div>

          <ModeloExemploImagem
            src={modelo.exemplo_imagem_url}
            slug={modelo.slug}
            alt={`Exemplo de layout — ${modelo.nome}`}
            fallback={modeloExemploFallback(modelo.slug)}
            className="mb-4"
          />

          <p className="mb-4 rounded-lg border border-amber-200/70 bg-amber-50/90 px-3 py-2.5 text-xs leading-relaxed text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/25 dark:text-amber-100">
            A imagem de exemplo mostra o <strong>layout</strong> do modelo (onde entram logo, mídia e
            mensagem). No seu post de verdade, tudo isso vem da sua identidade, do acervo e do pedido no
            chat.
          </p>

          <div className="space-y-4">
            <ModeloListaBullets titulo="Quando usar" itens={modelo.quando_usar} />
            <ModeloListaBullets titulo="O que torna este modelo único" itens={modelo.diferencial} />

            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Ênfase visual
              </h3>
              <ul className="space-y-1.5">
                {(modelo.enfase || []).map((item) => (
                  <li
                    key={item}
                    className="flex gap-2 rounded-lg border border-border bg-background px-2.5 py-2 text-xs leading-snug text-foreground"
                  >
                    <span className="mt-0.5 text-accent" aria-hidden>
                      •
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Estrutura da arte
              </h3>
              <ul className="space-y-1.5">
                {(modelo.estrutura || []).map((zona) => (
                  <li
                    key={`${zona.zona}-${zona.conteudo}`}
                    className="rounded-lg border border-border bg-background px-2.5 py-2 text-xs"
                  >
                    <span className="font-medium text-foreground">{zona.zona}</span>
                    <span className="text-muted-foreground"> — {zona.conteudo}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-border bg-surface-elevated/80 px-4 py-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-foreground">
              {modelo.ativo ? "Ativo no chat" : "Inativo"}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {modelo.ativo ? "Disponível ao gerar posts" : "Ative para usar no chat"}
            </p>
          </div>
          <ModeloToggle
            ativo={modelo.ativo}
            disabled={!podeGerenciar || toggling}
            label={`${modelo.ativo ? "Desativar" : "Ativar"} ${modelo.nome}`}
            onChange={(next) => onToggle(modelo, next)}
          />
        </div>
      </section>
    </div>
  );
}

export default function ModelosPostPage() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [msgKind, setMsgKind] = useState("ok");
  const [empresaId, setEmpresaId] = useState(null);
  const [podeGerenciar, setPodeGerenciar] = useState(false);
  const [modelos, setModelos] = useState([]);
  const [detalhe, setDetalhe] = useState(null);
  const [togglingSlug, setTogglingSlug] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setMsg("");
    const minhas = await authApiFetchWithToken("/empresas/minhas");
    if (!minhas.ok) {
      setMsg(minhas.networkError?.message || formatAuthError(minhas.json) || "Falha ao carregar empresas.");
      setMsgKind("err");
      setLoading(false);
      return;
    }
    const list = Array.isArray(minhas.json?.empresas) ? minhas.json.empresas : [];
    const idEmp = resolveEmpresaAtivaId(list, {
      idEmpresaUltimaPerfil: idEmpresaUltimaFromMinhasPayload(minhas.json),
    });
    const row = empresaRowFromMinhas(list, idEmp);
    if (row?.empresa) setEmpresaAtiva(row.empresa);
    setEmpresaId(idEmp);
    const papel = String(row?.papel || "").toLowerCase();
    setPodeGerenciar(cargoPodeGerenciar(papel));

    if (!idEmp) {
      setModelos([]);
      setLoading(false);
      return;
    }

    const result = await authApiFetchWithToken(`/empresas/${encodeURIComponent(idEmp)}/modelos-post`);
    if (!result.ok) {
      setMsg(result.networkError?.message || formatAuthError(result.json) || "Falha ao carregar modelos.");
      setMsgKind("err");
      setModelos([]);
      setLoading(false);
      return;
    }
    const items = Array.isArray(result.json?.modelos) ? result.json.modelos : [];
    setModelos(items);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (loading || !modelos.length) return;
    const wantedSlug = String(searchParams.get("modelo") || "").trim();
    const wantedId = String(searchParams.get("contexto") || "").trim();
    let found = null;
    if (wantedSlug) {
      found = modelos.find((m) => m.slug === wantedSlug);
    } else if (wantedId) {
      found = modelos.find(
        (m) => String(m.id_empresa_modelo_post || m.id_contexto_empresa || "") === wantedId,
      );
    }
    if (found) setDetalhe(found);
  }, [loading, modelos, searchParams]);

  async function handleToggle(modelo, ativo) {
    if (!empresaId || !podeGerenciar) return;
    setTogglingSlug(modelo.slug);
    setMsg("");
    const result = await authApiFetchWithToken(
      `/empresas/${encodeURIComponent(empresaId)}/modelos-post/${encodeURIComponent(modelo.slug)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ativo }),
      },
    );
    setTogglingSlug("");
    if (!result.ok) {
      setMsg(result.networkError?.message || formatAuthError(result.json) || "Não foi possível atualizar o modelo.");
      setMsgKind("err");
      return;
    }
    const patch = result.json?.modelo;
    setModelos((prev) =>
      prev.map((m) =>
        m.slug === modelo.slug
          ? {
              ...m,
              ativo: Boolean(patch?.ativo ?? ativo),
              id_empresa_modelo_post:
                patch?.id_empresa_modelo_post ?? (ativo ? m.id_empresa_modelo_post : null),
              id_contexto_empresa:
                patch?.id_contexto_empresa ?? (ativo ? m.id_contexto_empresa : null),
            }
          : m,
      ),
    );
    setDetalhe((prev) =>
      prev && prev.slug === modelo.slug
        ? {
            ...prev,
            ativo: Boolean(patch?.ativo ?? ativo),
            id_empresa_modelo_post:
              patch?.id_empresa_modelo_post ?? (ativo ? prev.id_empresa_modelo_post : null),
            id_contexto_empresa:
              patch?.id_contexto_empresa ?? (ativo ? prev.id_contexto_empresa : null),
          }
        : prev,
    );
    setMsg(ativo ? `${modelo.nome} ativado — disponível no chat.` : `${modelo.nome} desativado.`);
    setMsgKind("ok");
  }

  const ativosCount = useMemo(() => modelos.filter((m) => m.ativo).length, [modelos]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
      <header className="space-y-2">
        <h1 className="text-xl font-semibold text-foreground">Modelos de post</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Playbooks visuais curados pelo TumaIA. Ative os modelos que fazem sentido para sua loja —
          no chat, produto, preço e identidade entram automaticamente no pedido.
        </p>
      </header>

      {msg ? (
        <p
          className={[
            "rounded-xl border px-4 py-3 text-sm",
            msgKind === "err"
              ? "border-red-200 bg-red-50 text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200"
              : "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-100",
          ].join(" ")}
        >
          {msg}
        </p>
      ) : null}

      {!loading && !empresaId ? (
        <div className="rounded-xl border border-border bg-background p-6 text-sm text-muted-foreground">
          Cadastre uma empresa no painel antes de ativar modelos de post.
        </div>
      ) : null}

      {!podeGerenciar && empresaId ? (
        <p className="text-sm text-muted-foreground">Seu cargo permite apenas visualizar os modelos.</p>
      ) : null}

      {!loading && empresaId ? (
        <p className="text-sm text-muted-foreground">
          {ativosCount === 0
            ? "Nenhum modelo ativo — ative pelo menos um para aparecer no chat."
            : `${ativosCount} modelo${ativosCount === 1 ? "" : "s"} ativo${ativosCount === 1 ? "" : "s"} no chat.`}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando modelos…</p>
      ) : (
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:max-w-4xl">
          {modelos.map((modelo) => (
            <ModeloCard
              key={modelo.slug}
              modelo={modelo}
              podeGerenciar={podeGerenciar}
              toggling={togglingSlug === modelo.slug}
              onOpen={setDetalhe}
              onToggle={handleToggle}
            />
          ))}
        </section>
      )}

      <ModeloDetalheSheet
        open={Boolean(detalhe)}
        modelo={detalhe}
        onClose={() => setDetalhe(null)}
        podeGerenciar={podeGerenciar}
        toggling={Boolean(detalhe && togglingSlug === detalhe.slug)}
        onToggle={handleToggle}
      />
    </div>
  );
}
