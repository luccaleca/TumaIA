"use client";

import Link from "next/link";
import { useState } from "react";

/**
 * Layout compartilhado login/cadastro — fundo com imagem + card vidro em duas colunas.
 */
export default function AuthLayout({
  variant = "login",
  title,
  subtitle,
  switchHref,
  switchLabel,
  switchAriaLabel,
  children,
}) {
  const isLogin = variant === "login";

  return (
    <main className="auth-page relative min-h-screen overflow-hidden">
      <div className="auth-page-bg absolute inset-0" aria-hidden />
      <div className="auth-page-overlay absolute inset-0" aria-hidden />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-8 md:px-8 md:py-10">
        <Link
          href="/"
          className="auth-logo mb-6 inline-flex w-fit items-center gap-1 text-xl font-bold tracking-tight text-white drop-shadow-sm transition-opacity hover:opacity-90"
          title="Voltar à página inicial"
        >
          <span>Tuma</span>
          <span className="text-accent">IA</span>
        </Link>

        <div className="flex flex-1 items-center justify-center">
          <div className="auth-glass-card relative grid w-full max-w-4xl overflow-hidden rounded-[1.75rem] md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
            {/* Painel de boas-vindas */}
            <aside className="auth-panel-welcome relative flex min-h-[280px] flex-col justify-between p-6 md:min-h-0 md:p-8">
              <div className="relative z-10">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
                  {isLogin ? "Bem-vindo de volta" : "Comece agora"}
                </p>
                <h2 className="mt-2 text-2xl font-bold leading-tight text-white md:text-3xl">
                  {isLogin ? (
                    <>
                      Acesse sua
                      <br />
                      <span className="text-accent">conta</span>
                    </>
                  ) : (
                    <>
                      Crie sua
                      <br />
                      <span className="text-accent">conta</span>
                    </>
                  )}
                </h2>
                <p className="mt-3 max-w-[14rem] text-sm leading-relaxed text-white/75 md:max-w-xs">
                  {isLogin
                    ? "Automatize posts do WhatsApp para o Instagram com a identidade da sua marca."
                    : "Cadastro rápido para começar a produzir conteúdo pelo WhatsApp."}
                </p>
              </div>

              <div className="relative z-10 mt-6 flex flex-col items-center gap-3 text-center md:mt-8">
                <p className="text-sm font-medium text-white/80">
                  {isLogin ? "Ainda não tem conta?" : "Já tem conta?"}
                </p>
                <Link href={switchHref} className="auth-btn-welcome inline-flex cursor-pointer">
                  {switchLabel}
                </Link>
              </div>

              {/* Troca login ↔ cadastro — centralizado na borda direita do painel */}
              <Link
                href={switchHref}
                aria-label={switchAriaLabel}
                className="auth-switch-pill absolute right-0 top-1/2 z-30 hidden h-11 w-11 -translate-y-1/2 translate-x-1/2 cursor-pointer items-center justify-center rounded-full md:flex"
              >
                <span aria-hidden>⇄</span>
              </Link>
            </aside>

            {/* Formulário */}
            <section
              className={`auth-panel-form relative p-6 md:p-8 ${!isLogin ? "auth-panel-form--compact" : ""}`}
            >
              <div className={isLogin ? "mb-5 md:mb-6" : "mb-3 md:mb-4"}>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-800/70">
                  {isLogin ? "Faça login" : "Cadastro"}
                </p>
                <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
                {subtitle ? (
                  <p className={`text-sm text-slate-600 ${isLogin ? "mt-2" : "mt-1"}`}>{subtitle}</p>
                ) : null}
              </div>

              {children}

              <Link
                href="/"
                className={`auth-link-home inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-emerald-700 ${isLogin ? "mt-6" : "mt-4"}`}
              >
                <span aria-hidden>←</span>
                Página inicial
              </Link>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}

export function AuthField({ id, label, type = "text", value, onChange, required = false, optional = false }) {
  return (
    <div>
      <label className="auth-label" htmlFor={id}>
        {label}
        {optional ? <span className="font-normal text-slate-500"> (opcional)</span> : null}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={onChange}
        className="auth-input"
        required={required}
      />
    </div>
  );
}

function AuthPasswordToggleIcon({ visible }) {
  if (visible) {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M3 3l18 18M10.58 10.58A2 2 0 0 0 12 15a2 2 0 0 0 1.42-.58M9.88 5.09A10.94 10.94 0 0 1 12 5c5 0 9.27 3.11 11 7.5a11.8 11.8 0 0 1-2.08 3.2M6.61 6.61A11.8 11.8 0 0 0 1 12.5C2.73 16.89 7 20 12 20a10.94 10.94 0 0 0 4.91-1.12"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M2 12.5C3.73 8.11 8 5 13 5s9.27 3.11 11 7.5c-1.73 4.39-6 7.5-11 7.5S3.73 16.89 2 12.5Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="13" cy="12.5" r="3" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  );
}

export function AuthPasswordField({ id, label, value, onChange, required = false, autoComplete = "current-password" }) {
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <label className="auth-label" htmlFor={id}>
        {label}
      </label>
      <div className="auth-password-wrap">
        <input
          id={id}
          type="text"
          value={value}
          onChange={onChange}
          className={`auth-input auth-input--password${visible ? "" : " auth-input--masked"}`}
          required={required}
          autoComplete={autoComplete}
          spellCheck={false}
          autoCorrect="off"
          autoCapitalize="off"
        />
        <button
          type="button"
          className="auth-password-toggle"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => setVisible((prev) => !prev)}
          aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
          aria-pressed={visible}
        >
          <AuthPasswordToggleIcon visible={visible} />
        </button>
      </div>
    </div>
  );
}

export function AuthMessage({ kind, children }) {
  if (!children) return null;
  return (
    <p
      className={`mt-3 rounded-xl px-3 py-2 text-sm ${
        kind === "err"
          ? "border border-red-300/80 bg-red-50/90 font-medium text-red-900"
          : "border border-emerald-400/40 bg-emerald-50/90 text-emerald-900"
      }`}
    >
      {children}
    </p>
  );
}

export function AuthSubmitButton({ loading, loadingLabel, children }) {
  return (
    <button type="submit" disabled={loading} className="auth-btn-primary">
      {loading ? loadingLabel : children}
    </button>
  );
}
