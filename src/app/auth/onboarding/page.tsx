import Image from "next/image";
import Link from "next/link";

export default function OnboardingPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-5 py-10">
      <section className="relative grid w-full max-w-5xl overflow-visible rounded-3xl border border-white/10 bg-white shadow-[0_24px_50px_-30px_rgba(0,0,0,0.65)] md:grid-cols-[0.95fr_1.05fr]">
        <aside className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-[#009938] via-[#00B341] to-[#00c94a] p-8 text-white md:flex">
          <div className="relative z-10">
            <div className="inline-flex rounded-full border border-white/35 bg-white/10 px-3 py-2 backdrop-blur-sm">
              <Image
                src="/images/tumaia-logo-transparent.png"
                alt="TumaIA"
                width={140}
                height={40}
                className="h-8 w-auto max-w-[140px] object-contain brightness-0 invert"
              />
            </div>
            <h2 className="mt-5 text-3xl font-extrabold leading-tight">
              Bem-vindo ao seu novo painel inteligente.
            </h2>
            <p className="mt-3 text-sm text-green-50">
              Vamos cadastrar sua empresa para personalizar os conteúdos que o
              Tuma vai gerar para você.
            </p>
          </div>

          <div className="relative z-10 mt-8 flex flex-col items-start gap-3 sm:flex-row sm:items-end">
            <Image
              src="/images/tuma-mascote.png"
              alt="Tuma, assistente virtual"
              width={180}
              height={220}
              className="h-auto w-36 shrink-0 drop-shadow-[0_12px_24px_rgba(0,0,0,0.35)] sm:w-40"
            />
            <div className="relative z-10 max-w-sm rounded-2xl rounded-bl-md bg-white/20 p-4 text-sm leading-relaxed backdrop-blur-md">
              <p className="font-medium text-white">
                Oi! Conta um pouco sobre a sua empresa aqui ao lado — assim eu
                aprendo o tom certo pra gerar posts que parecem com você.
              </p>
            </div>
          </div>
        </aside>

        <div className="relative p-7 sm:p-10">
          <div className="mb-4 flex items-start justify-between gap-4 md:hidden">
            <Image
              src="/images/tumaia-logo.png"
              alt="TumaIA"
              width={160}
              height={48}
              className="h-10 w-auto object-contain"
            />
            <div className="flex shrink-0 flex-col items-end gap-2">
              <Image
                src="/images/tuma-mascote.png"
                alt="Tuma"
                width={72}
                height={220}
                className="h-20 w-auto object-contain object-bottom drop-shadow-md"
              />
              <p className="max-w-[10rem] rounded-2xl rounded-tr-sm border border-green-100 bg-green-50 px-3 py-2 text-xs font-medium text-green-900">
                Estou aqui se precisar de ajuda com o cadastro!
              </p>
            </div>
          </div>

          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
            Queremos te conhecer um pouco mais!
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Complete os dados da sua empresa para concluir o cadastro.
          </p>

          <form className="mt-8 space-y-4">
            <div>
              <label
                htmlFor="companyName"
                className="mb-1 block text-sm font-medium text-slate-700"
              >
                Nome da Empresa
              </label>
              <input
                id="companyName"
                type="text"
                placeholder="Ex: Loja Exemplo LTDA"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition-all duration-200 placeholder:text-slate-400 focus:border-green-500 focus:ring-4 focus:ring-green-500/15"
              />
            </div>

            <div>
              <label
                htmlFor="companyDescription"
                className="mb-1 block text-sm font-medium text-slate-700"
              >
                Nicho de mercado / Sobre o que é a empresa
              </label>
              <textarea
                id="companyDescription"
                rows={4}
                placeholder="Descreva seu negócio, produtos e público-alvo."
                className="w-full resize-y rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition-all duration-200 placeholder:text-slate-400 focus:border-green-500 focus:ring-4 focus:ring-green-500/15"
              />
            </div>

            <div>
              <label
                htmlFor="companyLogo"
                className="mb-1 block text-sm font-medium text-slate-700"
              >
                Upload de Logo
              </label>
              <input
                id="companyLogo"
                type="file"
                className="w-full rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-[#00B341] file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white hover:file:bg-[#009638]"
              />
            </div>

            <Link
              href="/dashboard"
              className="mt-2 flex w-full items-center justify-center rounded-xl bg-[#00B341] px-4 py-3 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#009638]"
            >
              Confirmar / Concluir Cadastro
            </Link>
          </form>
        </div>
      </section>
    </main>
  );
}
