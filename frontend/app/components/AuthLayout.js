"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import "../auth.css";

/**
 * Layout compartilhado login/cadastro — painel escuro de boas-vindas + formulário em tela dividida.
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
    <main className="auth-page">
      <aside className="auth-panel-welcome">
        <Link href="/" className="auth-logo" title="Voltar à página inicial">
          <span>Tuma</span>
          <span>IA</span>
        </Link>

        <div className="auth-welcome__body">
          <p className="auth-welcome__eyebrow">{isLogin ? "Bem-vindo de volta" : "Comece agora"}</p>
          <h2 className="auth-welcome__title">
            {isLogin ? "Acesse sua" : "Crie sua"} <span>conta</span>
          </h2>
          <p className="auth-welcome__text">
            {isLogin
              ? "Automatize posts do WhatsApp para o Instagram com a identidade da sua marca."
              : "Cadastro rápido para começar a produzir conteúdo pelo WhatsApp."}
          </p>
        </div>

        <div className="auth-welcome__switch">
          <p>{isLogin ? "Ainda não tem conta?" : "Já tem conta?"}</p>
          <Link href={switchHref} aria-label={switchAriaLabel} className="auth-btn-welcome">
            {switchLabel}
          </Link>
        </div>

        <Image
          src="/imagens/TUMA_CROPPED.png"
          alt=""
          width={967}
          height={1453}
          sizes="160px"
          className="auth-welcome__mascot"
        />
      </aside>

      <section className="auth-panel-form">
        <div className="auth-form-inner">
          <div className={`auth-form-head ${!isLogin ? "auth-form-head--compact" : ""}`}>
            <p className="auth-form-eyebrow">{isLogin ? "Faça login" : "Cadastro"}</p>
            <h1 className="auth-form-title">{title}</h1>
            {subtitle ? <p className="auth-form-sub">{subtitle}</p> : null}
          </div>

          {children}

          <Link href="/" className="auth-link-home mt-4">
            <span aria-hidden>←</span>
            Página inicial
          </Link>
        </div>
      </section>
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
      role={kind === "err" ? "alert" : "status"}
      className={`mt-4 rounded-xl px-4 py-3 text-sm ${
        kind === "err"
          ? "border border-red-300 bg-red-50 font-medium text-red-900"
          : "border border-emerald-300 bg-emerald-50 text-emerald-900"
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
