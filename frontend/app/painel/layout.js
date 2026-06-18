"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ThemeProvider, useTheme } from "../components/ThemeProvider";
import {
  DEV_DASHBOARD_PREVIEW_KEY,
  clearDevDashboardPreview,
  clearToken,
  fetchMe,
} from "../../lib/auth";

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

function IconContextos() {
  return (
    <NavIcon>
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" className="h-[18px] w-[18px]">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
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

function NavLink({ item, active }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
        active
          ? "bg-accent font-semibold text-accent-foreground shadow-sm"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
      aria-current={active ? "page" : undefined}
    >
      <Icon />
      <span>{item.label}</span>
    </Link>
  );
}

function PainelShell({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [nome, setNome] = useState("...");
  const [ready, setReady] = useState(false);
  const { theme } = useTheme();

  useEffect(() => {
    let active = true;
    if (
      typeof window !== "undefined" &&
      process.env.NODE_ENV === "development" &&
      sessionStorage.getItem(DEV_DASHBOARD_PREVIEW_KEY) === "1"
    ) {
      setNome("Pré-visualização (sem login)");
      setReady(true);
      return () => {
        active = false;
      };
    }
    fetchMe().then(({ ok, usuario }) => {
      if (!active) return;
      if (!ok || !usuario) {
        clearToken();
        router.replace("/login");
        return;
      }
      const fallback = usuario?.email ? String(usuario.email).split("@")[0] : "usuário";
      setNome(String(usuario.nome || "").trim() || fallback || "usuário");
      setReady(true);
    });
    return () => {
      active = false;
    };
  }, [router]);

  const mainNav = useMemo(
    () => [
      { href: "/painel/chat", label: "Chat", icon: IconChat },
      { href: "/painel/empresa", label: "Empresa", icon: IconEmpresa },
      { href: "/painel/contextos", label: "Modelos de post", icon: IconContextos },
      { href: "/painel/midias", label: "Mídias", icon: IconMidias },
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
          <header className="border-b border-border bg-background/90 backdrop-blur-md">
            <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
              <Link href="/" className="text-lg font-bold tracking-tight">
                <span className="text-foreground">Tuma</span>
                <span className="text-accent">IA</span>
              </Link>
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">
                  Olá, <strong className="text-foreground">{nome}</strong>
                </span>
                <button
                  type="button"
                  onClick={onLogout}
                  className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground transition-colors hover:border-foreground/25 hover:bg-surface-elevated"
                >
                  Sair
                </button>
              </div>
            </div>
          </header>

          <div className="mx-auto flex w-full max-w-6xl flex-col items-stretch gap-6 px-6 py-6 md:flex-row md:items-start">
            <aside className="mx-auto flex w-full max-w-[240px] shrink-0 flex-col rounded-xl border border-border bg-surface p-2 md:mx-0 md:w-[240px]">
              <nav className="flex flex-col gap-0.5 pt-1" aria-label="Menu principal">
                {mainNav.map((item) => (
                  <NavLink key={item.href} item={item} active={isActive(item.href)} />
                ))}
              </nav>

              <div className="my-2 border-t border-border" role="separator" />

              <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Sua conta
              </p>
              <nav className="flex flex-col gap-0.5" aria-label="Conta e configurações">
                {accountNav.map((item) => (
                  <NavLink key={item.href} item={item} active={isActive(item.href)} />
                ))}
              </nav>
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
