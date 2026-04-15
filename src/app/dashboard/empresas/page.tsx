import Link from "next/link";

const mockEmpresas = [
  {
    id: "1",
    name: "Loja Exemplo LTDA",
    niche: "Varejo de moda",
    postsEsteMes: 12,
  },
];

export default function EmpresasPage() {
  return (
    <div
      className="space-y-6"
      style={{ animation: "fade-in 450ms ease-out both" }}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Minhas Empresas</h1>
          <p className="mt-1 text-sm text-slate-600">
            Gerencie marcas cadastradas e dados que alimentam o bot no WhatsApp.
          </p>
        </div>
        <Link
          href="/auth/onboarding"
          className="inline-flex items-center justify-center rounded-xl bg-[#00B341] px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-[#009638]"
        >
          Adicionar empresa
        </Link>
      </div>

      <ul className="grid gap-4 md:grid-cols-2">
        {mockEmpresas.map((emp, i) => (
          <li
            key={emp.id}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:shadow-md"
            style={{ animation: `fade-in 400ms ease-out ${i * 60}ms both` }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-lg font-semibold text-slate-900">{emp.name}</p>
                <p className="mt-1 text-sm text-slate-600">{emp.niche}</p>
              </div>
              <span className="shrink-0 rounded-full bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-800">
                {emp.postsEsteMes} posts / mês
              </span>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-800 hover:border-green-200 hover:bg-green-50"
              >
                Editar
              </button>
              <button
                type="button"
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-800 hover:border-slate-300"
              >
                Ver detalhes
              </button>
            </div>
          </li>
        ))}
      </ul>

      {mockEmpresas.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          Nenhuma empresa ainda. Clique em &quot;Adicionar empresa&quot; para
          começar.
        </p>
      ) : null}
    </div>
  );
}
