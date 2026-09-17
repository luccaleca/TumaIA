"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

const EMPRESA_NAV = [
  { href: "/painel/tumacore/empresa/dashboard", label: "Dashboard" },
  { href: "/painel/tumacore/empresa/analytics", label: "Analytics" },
];

/**
 * Nav do TumaCore Empresa — identidade no padrão do Chat (mascote natural + texto).
 */
export default function TumaCoreEmpresaLayout({ children }) {
  const pathname = usePathname();

  const current =
    EMPRESA_NAV.find(
      (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
    ) || EMPRESA_NAV[0];

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
          {EMPRESA_NAV.map((item) => {
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
