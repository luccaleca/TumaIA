import Image from "next/image";
import Link from "next/link";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-white to-slate-100 px-5 py-10 text-slate-900">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-[0_24px_50px_-30px_rgba(0,0,0,0.35)]">
        <div className="mb-6 flex justify-center">
          <Image
            src="/images/tumaia-logo.png"
            alt="TumaIA"
            width={220}
            height={64}
            priority
            className="h-14 w-auto object-contain md:h-16"
          />
        </div>

        <h1 className="text-center text-2xl font-bold leading-tight">
          Faça login ou crie uma conta
        </h1>
        <p className="mt-2 text-center text-sm text-slate-600">
          Entre com seu contato para acessar seu painel.
        </p>

        <form className="mt-7 space-y-4">
          <label className="block text-sm font-medium text-slate-700" htmlFor="contact">
            Digite um número de celular ou e-mail
          </label>
          <input
            id="contact"
            type="text"
            placeholder="(11) 99999-9999 ou voce@empresa.com"
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition-all duration-200 placeholder:text-slate-400 focus:border-green-500 focus:ring-4 focus:ring-green-500/15"
          />

          <Link
            href="/dashboard"
            className="flex w-full items-center justify-center rounded-xl bg-[#00B341] px-4 py-3 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#009638]"
          >
            Entrar
          </Link>

          <Link
            href="/auth/onboarding"
            className="flex w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-800 transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-400"
          >
            Criar Conta
          </Link>
        </form>

        <p className="mt-6 text-center text-xs leading-relaxed text-slate-500">
          Ao continuar, você concorda com os Termos de Uso e a Política de
          Privacidade do TumaIA.
        </p>
      </section>
    </main>
  );
}
