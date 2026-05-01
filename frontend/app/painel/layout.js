"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { clearToken, fetchMe } from "../../lib/auth";

export default function PainelLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [nome, setNome] = useState("...");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
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
      { href: "/painel/conta", label: "Conta" },
      { href: "/painel/empresa", label: "Empresa" },
      { href: "/painel/contextos", label: "Contextos" },
      { href: "/painel/midias", label: "Mídias" },
    ],
    [],
  );

  function onLogout() {
    clearToken();
    router.replace("/");
  }

  if (!ready) {
    return <main className="p-8 text-sm text-zinc-600">Carregando sessão...</main>;
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-lg font-bold tracking-tight text-zinc-900">
            TumaIA
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-sm text-zinc-700">
              Olá, <strong>{nome}</strong>
            </span>
            <button
              type="button"
              onClick={onLogout}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-800"
            >
              Sair
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-6 px-6 py-6 md:grid-cols-[220px_1fr]">
        <aside className="rounded-xl border border-zinc-200 bg-white p-3">
          <nav className="space-y-1">
            {links.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`block rounded-lg px-3 py-2 text-sm ${
                    active ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-100"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        <section>{children}</section>
      </div>
    </div>
  );
}
