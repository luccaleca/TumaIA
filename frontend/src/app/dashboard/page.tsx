import Link from "next/link";

const summaryCards = [
  { title: "Plano Atual", value: "Pro", helper: "Renovacao em 24 dias" },
  { title: "Empresas Cadastradas", value: "1", helper: "Limite atual: 3" },
  { title: "Posts Gerados este mes", value: "12", helper: "+4 vs ultimo mes" },
];

const quickActions = [
  {
    label: "Editar informacoes da empresa",
    hint: "Atualize nicho, tom de voz e objetivos",
    href: "/dashboard/empresas",
  },
  {
    label: "Adicionar nova empresa",
    hint: "Cadastre outra marca no mesmo painel",
    href: "/auth/onboarding",
  },
  {
    label: "Consultar Planos",
    hint: "Veja recursos e limites disponiveis",
    href: "/dashboard",
  },
];

export default function DashboardPage() {
  return (
    <div className="space-y-6 md:space-y-7">
      <section className="animate-[fade-in_450ms_ease-out] rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">
          Bem-vindo ao seu Dashboard
        </h1>
        <p className="mt-2 text-sm text-slate-600 md:text-base">
          Acompanhe seu plano, organize suas empresas e acesse tudo em poucos
          cliques.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {summaryCards.map((card, index) => (
          <article
            key={card.title}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md"
            style={{ animation: `fade-in 450ms ease-out ${index * 80}ms both` }}
          >
            <p className="text-sm font-medium text-slate-500">{card.title}</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{card.value}</p>
            <p className="mt-2 text-sm text-green-700">{card.helper}</p>
          </article>
        ))}
      </section>

      <section
        className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        style={{ animation: "fade-in 500ms ease-out 150ms both" }}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900">Acesso Rapido</h2>
          <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
            atalhos
          </span>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {quickActions.map((action) => (
            <Link
              key={action.label}
              href={action.href}
              className="group rounded-xl border border-slate-200 bg-slate-50 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-green-300 hover:bg-green-50"
            >
              <p className="text-sm font-semibold text-slate-800 transition-colors duration-200 group-hover:text-green-700">
                {action.label}
              </p>
              <p className="mt-1 text-xs text-slate-600">{action.hint}</p>
            </Link>
          ))}
        </div>
      </section>

      <section
        className="rounded-2xl border border-green-200 bg-gradient-to-r from-green-50 via-white to-green-50 p-6 shadow-sm"
        style={{ animation: "fade-in 550ms ease-out 250ms both" }}
      >
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-600 text-2xl text-white">
            T
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.12em] text-green-700">
              Mensagem do Tuma
            </p>
            <p className="mt-1 text-sm leading-relaxed text-slate-700 md:text-base">
              Tudo pronto! Seu bot ja esta conectado. Me mande um "Oi" no
              WhatsApp para comecarmos a gerar seus posts!
            </p>
            <p className="mt-2 text-xs text-slate-500">
              TODO: Carregar status real de conexao do bot via backend.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
