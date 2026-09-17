"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  DEV_DASHBOARD_PREVIEW_KEY,
  authApiFetchWithToken,
  fetchMe,
} from "../../../lib/auth";
import { isDonoPlataformaUsuario } from "../../../lib/plataformaAdmin";
import { isAdminTumaCoreEmpresa } from "../../../lib/tumacoreEmpresa";

const TUMACORE_PLATAFORMA_NAV = [
  { href: "/painel/tumacore/dashboard", label: "Dashboard" },
  { href: "/painel/tumacore/clientes", label: "Clientes" },
  { href: "/painel/tumacore/analytics", label: "Analytics" },
  { href: "/painel/tumacore/chat-sql", label: "Chat SQL" },
];

function isEmpresaScopePath(pathname) {
  return String(pathname || "").startsWith("/painel/tumacore/empresa");
}

/**
 * Área TumaCore — Plataforma (dono) ou Empresa (admin cliente).
 */
export default function TumaCoreLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const empresaScope = isEmpresaScopePath(pathname);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let active = true;
    if (
      typeof window !== "undefined" &&
      process.env.NODE_ENV === "development" &&
      sessionStorage.getItem(DEV_DASHBOARD_PREVIEW_KEY) === "1"
    ) {
      setAllowed(true);
      return () => {
        active = false;
      };
    }

    (async () => {
      if (empresaScope) {
        const minhas = await authApiFetchWithToken("/empresas/minhas");
        if (!active) return;
        if (!minhas.ok || !isAdminTumaCoreEmpresa(minhas.json?.empresas)) {
          router.replace("/painel/chat");
          return;
        }
        setAllowed(true);
        return;
      }

      const { ok, usuario } = await fetchMe();
      if (!active) return;
      if (ok && isDonoPlataformaUsuario(usuario)) {
        setAllowed(true);
        return;
      }

      const minhas = await authApiFetchWithToken("/empresas/minhas");
      if (!active) return;
      if (minhas.ok && isAdminTumaCoreEmpresa(minhas.json?.empresas)) {
        router.replace("/painel/tumacore/empresa/dashboard");
        return;
      }

      router.replace("/painel/chat");
    })();

    return () => {
      active = false;
    };
  }, [router, pathname, empresaScope]);

  if (!allowed) {
    return (
      <main className="py-6 text-sm text-muted-foreground">
        Verificando acesso…
      </main>
    );
  }

  if (empresaScope) {
    return <div className="min-w-0">{children}</div>;
  }

  const current =
    TUMACORE_PLATAFORMA_NAV.find(
      (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
    ) || TUMACORE_PLATAFORMA_NAV[0];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <div className="inline-flex items-center gap-0">
          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-background md:h-24 md:w-24">
            <Image
              src="/imagens/tumacore-mascote.png"
              alt=""
              fill
              className="object-contain p-1"
              sizes="96px"
              priority
              unoptimized
              aria-hidden
            />
          </div>
          <span className="text-2xl font-black tracking-tight text-foreground md:text-3xl">
            <span className="text-accent">Tuma</span>
            Core
          </span>
        </div>

        <nav className="flex flex-wrap items-center gap-0.5" aria-label="Seção TumaCore">
          {TUMACORE_PLATAFORMA_NAV.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-md px-2.5 py-1.5 text-sm transition-colors ${
                  active
                    ? "bg-accent/15 font-medium text-accent"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
                aria-current={active ? "page" : undefined}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <span className="sr-only">Seção atual: {current.label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
