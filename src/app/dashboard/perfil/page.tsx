export default function PerfilPage() {
  return (
    <div
      className="mx-auto max-w-3xl space-y-6"
      style={{ animation: "fade-in 450ms ease-out both" }}
    >
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
        <h1 className="text-2xl font-bold text-slate-900">Meu Perfil</h1>
        <p className="mt-2 text-sm text-slate-600">Dados da sua conta.</p>

        <form className="mt-8 grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="name" className="mb-1 block text-sm font-medium text-slate-700">
              Nome completo
            </label>
            <input
              id="name"
              type="text"
              defaultValue="Diego"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-green-500 focus:ring-4 focus:ring-green-500/15"
            />
          </div>
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-700">
              E-mail
            </label>
            <input
              id="email"
              type="email"
              defaultValue="diego@exemplo.com"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-green-500 focus:ring-4 focus:ring-green-500/15"
            />
          </div>
          <div>
            <label htmlFor="phone" className="mb-1 block text-sm font-medium text-slate-700">
              Celular (WhatsApp)
            </label>
            <input
              id="phone"
              type="tel"
              defaultValue="(11) 99999-9999"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-green-500 focus:ring-4 focus:ring-green-500/15"
            />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="bio" className="mb-1 block text-sm font-medium text-slate-700">
              Bio (opcional)
            </label>
            <textarea
              id="bio"
              rows={3}
              placeholder="Uma linha sobre você ou seu papel na empresa"
              className="w-full resize-y rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-green-500 focus:ring-4 focus:ring-green-500/15"
            />
          </div>
        </form>

        <div className="mt-8 flex flex-wrap gap-3">
          <button
            type="button"
            className="rounded-xl bg-[#00B341] px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-[#009638]"
          >
            Salvar alterações
          </button>
          <button
            type="button"
            className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 hover:border-slate-400"
          >
            Cancelar
          </button>
        </div>
      </section>
    </div>
  );
}
