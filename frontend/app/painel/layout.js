"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ThemeProvider, useTheme } from "../components/ThemeProvider";
import {
  DEV_DASHBOARD_PREVIEW_KEY,
  authApiFetchWithToken,
  clearDevDashboardPreview,
  clearToken,
  fetchMe,
} from "../../lib/auth";
import { EMPRESA_ATIVA_CHANGE_EVENT, getEmpresaAtivaId } from "../../lib/empresaAtiva";
import { isDonoPlataformaUsuario } from "../../lib/plataformaAdmin";
import { isAdminTumaCoreEmpresa } from "../../lib/tumacoreEmpresa";

function NavIcon({ children, className = "" }) {
  return (
    <span className={`inline-flex h-5 w-5 shrink-0 items-center justify-center ${className}`} aria-hidden>
      {children}
    </span>
  );
}

function IconChat() {
  return (
    <NavIcon>
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" className="h-[18px] w-[18px]">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
      </svg>
    </NavIcon>
  );
}

function IconEmpresa() {
  return (
    <NavIcon>
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" className="h-[18px] w-[18px]">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3.75 21h16.5M4.5 21V5.25A2.25 2.25 0 0 1 6.75 3h10.5a2.25 2.25 0 0 1 2.25 2.25V21M9 21v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M9 10.5h.008v.008H9V10.5Zm3 0h.008v.008H12V10.5Zm3 0h.008v.008H15V10.5Z"
        />
      </svg>
    </NavIcon>
  );
}

function IconMidias() {
  return (
    <NavIcon>
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" className="h-[18px] w-[18px]">
        <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
      </svg>
    </NavIcon>
  );
}

function IconAgendados() {
  return (
    <NavIcon>
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" className="h-[18px] w-[18px]">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      </svg>
    </NavIcon>
  );
}

function IconConfiguracao() {
  return (
    <NavIcon>
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" className="h-[18px] w-[18px]">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a7.713 7.713 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
      </svg>
    </NavIcon>
  );
}

function IconConta() {
  return (
    <NavIcon>
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" className="h-[18px] w-[18px]">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
      </svg>
    </NavIcon>
  );
}

function IconTumaCore() {
  return (
    <NavIcon>
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" className="h-[18px] w-[18px]">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6"
        />
      </svg>
    </NavIcon>
  );
}

const TUMACORE_PLATAFORMA_HREF = "/painel/tumacore/dashboard";
const TUMACORE_EMPRESA_HREF = "/painel/tumacore/empresa/dashboard";

function NavLink({ item, active }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={`group relative flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
        active
          ? "bg-accent text-[#06120c] shadow-[0_8px_20px_-10px] shadow-accent/70"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
      aria-current={active ? "page" : undefined}
    >
      <Icon />
      <span className="whitespace-nowrap">{item.label}</span>
    </Link>
  );
}

function PlanoBadge({ plano, carregado }) {
  if (!carregado) return null;
  if (!plano) {
    return (
      <span
        className="hidden shrink-0 rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground sm:inline"
        title="Esta empresa ainda não tem um plano ativo"
      >
        Sem plano
      </span>
    );
  }
  const vigente = plano.vigente !== false;
  return (
    <span
      className={`hidden shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold sm:inline ${
        vigente
          ? "bg-accent/15 text-accent ring-1 ring-accent/30"
          : "bg-muted text-muted-foreground ring-1 ring-border"
      }`}
      title={vigente ? `Plano ${plano.nome}` : `Plano ${plano.nome} (assinatura inativa)`}
    >
      Plano {plano.nome}
      {vigente ? "" : " · inativo"}
    </span>
  );
}

function iniciaisDoNome(nome) {
  const partes = String(nome || "").trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return "?";
  const first = partes[0][0] || "";
  const last = partes.length > 1 ? partes[partes.length - 1][0] : "";
  return `${first}${last}`.toUpperCase();
}

function PainelShell({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [nome, setNome] = useState("...");
  const [ready, setReady] = useState(false);
  const [donoPlataforma, setDonoPlataforma] = useState(false);
  const [adminEmpresa, setAdminEmpresa] = useState(false);
  const [plano, setPlano] = useState(null);
  const [planoCarregado, setPlanoCarregado] = useState(false);
  const { theme } = useTheme();

  useEffect(() => {
    let active = true;
    if (
      typeof window !== "undefined" &&
      process.env.NODE_ENV === "development" &&
      sessionStorage.getItem(DEV_DASHBOARD_PREVIEW_KEY) === "1"
    ) {
      setNome("Pré-visualização (sem login)");
      setDonoPlataforma(true);
      setAdminEmpresa(false);
      setReady(true);
      return () => {
        active = false;
      };
    }
    (async () => {
      const { ok, usuario } = await fetchMe();
      if (!active) return;
      if (!ok || !usuario) {
        clearToken();
        router.replace("/login");
        return;
      }
      const fallback = usuario?.email ? String(usuario.email).split("@")[0] : "usuário";
      setNome(String(usuario.nome || "").trim() || fallback || "usuário");
      const isDono = isDonoPlataformaUsuario(usuario);
      setDonoPlataforma(isDono);
      if (!isDono) {
        const minhas = await authApiFetchWithToken("/empresas/minhas");
        if (!active) return;
        setAdminEmpresa(Boolean(minhas.ok && isAdminTumaCoreEmpresa(minhas.json?.empresas)));
      } else {
        setAdminEmpresa(false);
      }
      setReady(true);
    })();
    return () => {
      active = false;
    };
  }, [router]);

  useEffect(() => {
    if (!ready) return undefined;
    if (
      process.env.NODE_ENV === "development" &&
      sessionStorage.getItem(DEV_DASHBOARD_PREVIEW_KEY) === "1"
    ) {
      return undefined;
    }
    let active = true;
    async function carregarPlano() {
      const idEmpresa = getEmpresaAtivaId();
      const qs = idEmpresa ? `?id_empresa=${encodeURIComponent(idEmpresa)}` : "";
      const r = await authApiFetchWithToken(`/empresas/plano-atual${qs}`);
      if (!active) return;
      setPlano(r.ok ? r.json?.plano ?? null : null);
      setPlanoCarregado(true);
    }
    void carregarPlano();
    window.addEventListener(EMPRESA_ATIVA_CHANGE_EVENT, carregarPlano);
    return () => {
      active = false;
      window.removeEventListener(EMPRESA_ATIVA_CHANGE_EVENT, carregarPlano);
    };
  }, [ready]);

  const mainNav = useMemo(
    () => [
      { href: "/painel/chat", label: "Chat", icon: IconChat },
      { href: "/painel/empresa", label: "Empresa", icon: IconEmpresa },
      { href: "/painel/midias", label: "Mídias", icon: IconMidias },
      { href: "/painel/agendados", label: "Agendados", icon: IconAgendados },
    ],
    [],
  );

  const accountNav = useMemo(
    () => [
      { href: "/painel/configuracao", label: "Configuração", icon: IconConfiguracao },
      { href: "/painel/conta", label: "Conta", icon: IconConta },
    ],
    [],
  );

  function isActive(href) {
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  function onLogout() {
    clearDevDashboardPreview();
    clearToken();
    router.replace("/");
  }

  return (
    <div
      className={`min-h-screen bg-background text-foreground transition-colors duration-200 ${theme === "dark" ? "dark" : ""}`}
    >
      {!ready ? (
        <main className="p-8 text-sm text-muted-foreground">Carregando sessão...</main>
      ) : (
        <>
          <header className="sticky top-0 z-40 border-b border-border/80 bg-background/80 backdrop-blur-xl">
            <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
              <Link
                href="/painel/chat"
                className="font-[family-name:var(--font-display)] text-xl font-bold tracking-tight"
              >
                <span className="text-foreground">Tuma</span>
                <span className="text-accent">IA</span>
              </Link>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2.5 rounded-full border border-border bg-surface p-1 sm:pr-3.5">
                  <span
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/15 text-xs font-bold text-accent"
                    aria-hidden
                  >
                    {iniciaisDoNome(nome)}
                  </span>
                  <span className="hidden max-w-[14rem] truncate text-sm text-muted-foreground sm:inline">
                    Olá, <strong className="font-semibold text-foreground">{nome}</strong>
                  </span>
                  <PlanoBadge plano={plano} carregado={planoCarregado} />
                </div>
                <button
                  type="button"
                  onClick={onLogout}
                  className="inline-flex min-h-10 items-center rounded-full border border-border bg-surface px-4 text-sm font-medium text-foreground transition-colors hover:border-foreground/25 hover:bg-surface-elevated"
                >
                  Sair
                </button>
              </div>
            </div>
          </header>

          <div className="mx-auto flex w-full max-w-6xl flex-col items-stretch gap-5 px-4 py-5 sm:px-6 md:flex-row md:items-start md:gap-8 md:py-8">
            <aside className="w-full shrink-0 md:sticky md:top-24 md:w-[250px]">
              <div className="flex gap-1 overflow-x-auto rounded-2xl border border-border bg-surface p-2 shadow-sm [scrollbar-width:none] md:flex-col md:overflow-visible md:p-3 [&::-webkit-scrollbar]:hidden">
                <nav className="flex gap-1 md:flex-col" aria-label="Menu principal">
                  {mainNav.map((item) => (
                    <NavLink key={item.href} item={item} active={isActive(item.href)} />
                  ))}
                </nav>

                {donoPlataforma || adminEmpresa ? (
                  <>
                    <div className="mx-1 my-1 hidden border-t border-border md:block" role="separator" />
                    {donoPlataforma ? (
                      <p className="hidden px-3 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground md:block">
                        Plataforma
                      </p>
                    ) : null}
                    <nav className="flex gap-1 md:flex-col" aria-label="Área TumaCore">
                      <NavLink
                        item={{
                          href: donoPlataforma ? TUMACORE_PLATAFORMA_HREF : TUMACORE_EMPRESA_HREF,
                          label: "TumaCore",
                          icon: IconTumaCore,
                        }}
                        active={
                          donoPlataforma
                            ? isActive("/painel/tumacore") &&
                              !pathname.startsWith("/painel/tumacore/empresa")
                            : isActive("/painel/tumacore/empresa")
                        }
                      />
                    </nav>
                  </>
                ) : null}

                <div className="mx-1 my-1 hidden border-t border-border md:block" role="separator" />

                <p className="hidden px-3 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground md:block">
                  Sua conta
                </p>
                <nav className="flex gap-1 md:flex-col" aria-label="Conta e configurações">
                  {accountNav.map((item) => (
                    <NavLink key={item.href} item={item} active={isActive(item.href)} />
                  ))}
                </nav>
              </div>
            </aside>

            <section className="min-w-0 flex-1">{children}</section>
          </div>
        </>
      )}
    </div>
  );
}

export default function PainelLayout({ children }) {
  return (
    <ThemeProvider>
      <PainelShell>{children}</PainelShell>
    </ThemeProvider>
  );
}
