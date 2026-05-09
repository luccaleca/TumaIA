"use client";

import { useTheme } from "../../components/ThemeProvider";

function Seg({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
        active
          ? "bg-surface-elevated text-foreground shadow-sm ring-1 ring-border"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

export default function ConfiguracaoPage() {
  const { theme, setTheme } = useTheme();

  return (
    <main className="rounded-xl border border-border bg-background p-6 transition-colors">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Configuração</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Preferências do painel e integrações — em construção.
        </p>
      </div>

      <div className="mt-8 space-y-4">
        <section className="rounded-lg border border-border bg-background px-4 py-4">
          <h2 className="text-sm font-medium text-foreground">Aparência</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Tema só no painel (não altera a página inicial nem o login).
          </p>
          <div
            className="mt-4 inline-flex flex-wrap gap-1 rounded-lg border border-border bg-background p-1"
            role="group"
            aria-label="Tema do painel"
          >
            <Seg active={theme === "light"} onClick={() => setTheme("light")}>
              Claro
            </Seg>
            <Seg active={theme === "dark"} onClick={() => setTheme("dark")}>
              Escuro
            </Seg>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            O escuro usa tons foscos e levemente esverdeados — sem preto puro.
          </p>
        </section>

        <section className="rounded-lg border border-border bg-background px-4 py-3">
          <h2 className="text-sm font-medium text-foreground">Notificações</h2>
          <p className="mt-1 text-sm text-muted-foreground">Alertas de publicação e e-mail em breve.</p>
        </section>

        <section className="rounded-lg border border-border bg-background px-4 py-3">
          <h2 className="text-sm font-medium text-foreground">Integrações</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Instagram, WhatsApp e geração de imagens ficarão configuráveis aqui conforme formos liberando.
          </p>
        </section>
      </div>
    </main>
  );
}
