/**
 * @param {{
 *   mostrarCodigo: boolean,
 *   onCriarEmpresa: () => void,
 *   onAbrirEntrar: () => void,
 *   onVoltar: () => void,
 *   codigo: string,
 *   onCodigoChange: (value: string) => void,
 *   onSubmitConvite: () => void,
 *   loading?: boolean,
 * }} props
 */
export default function EmpresaAcoesInicio({
  mostrarCodigo,
  onCriarEmpresa,
  onAbrirEntrar,
  onVoltar,
  codigo,
  onCodigoChange,
  onSubmitConvite,
  loading = false,
}) {
  if (mostrarCodigo) {
    return (
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmitConvite();
        }}
      >
        <input
          type="text"
          value={codigo}
          onChange={(e) => onCodigoChange(e.target.value.toUpperCase())}
          placeholder="Código do convite"
          autoComplete="off"
          spellCheck={false}
          className="min-w-[10rem] flex-1 rounded-lg border border-border bg-background px-3 py-1.5 font-mono text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 sm:max-w-xs"
        />
        <button
          type="submit"
          disabled={loading || !String(codigo || "").trim()}
          className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-accent-foreground hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Entrando…" : "Entrar"}
        </button>
        <button
          type="button"
          onClick={onVoltar}
          className="rounded-lg border border-border px-3 py-1.5 text-sm text-foreground hover:bg-muted"
        >
          Voltar
        </button>
      </form>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={onCriarEmpresa}
        className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-accent-foreground hover:opacity-95"
      >
        Criar empresa
      </button>
      <button
        type="button"
        onClick={onAbrirEntrar}
        className="rounded-lg border border-border bg-surface-elevated px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted"
      >
        Entrar
      </button>
    </div>
  );
}
