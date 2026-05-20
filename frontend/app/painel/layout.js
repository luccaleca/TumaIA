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

  const links = useMemo(
    () => [
      { href: "/painel/chat", label: "Chat" },
      { href: "/painel/conta", label: "Conta" },
      { href: "/painel/empresa", label: "Empresa" },
      { href: "/painel/contextos", label: "Contextos" },
      { href: "/painel/midias", label: "Mídias" },
      { href: "/painel/configuracao", label: "Configuração" },
    ],
    [],
  );

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
            <aside className="mx-auto w-[220px] shrink-0 rounded-xl border border-border bg-surface p-3 md:mx-0">
              <nav className="space-y-1">
                {links.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-2 rounded-md px-3 py-1 text-sm transition-colors ${
                        active
                          ? "bg-accent font-medium text-accent-foreground"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      {item.label}
                    </Link>
                  );
                })}
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
