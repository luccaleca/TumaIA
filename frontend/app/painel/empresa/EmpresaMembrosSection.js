import EmpresaSectionPanel from "./EmpresaSectionPanel";

/**
 * @param {{
 *   membros: Array<Record<string, unknown>>,
 *   canManageMembros: boolean,
 *   savingMembroId: string | null,
 *   onConvidar: () => void,
 *   onChangeCargo: (idUsuario: string, cargo: string) => void,
 *   onRemove: (membro: Record<string, unknown>) => void,
 * }} props
 */
export default function EmpresaMembrosSection({
  membros,
  canManageMembros,
  savingMembroId,
  onConvidar,
  onChangeCargo,
  onRemove,
}) {
  return (
    <EmpresaSectionPanel
      step={3}
      id="membros-empresa"
      title="Membros da empresa"
      description="Quem tem acesso a este workspace, cargos e convites."
      actions={
        canManageMembros ? (
          <button
            type="button"
            onClick={onConvidar}
            className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground shadow-sm hover:bg-muted"
          >
            Convidar
          </button>
        ) : null
      }
    >
      <div className="p-4 sm:p-5">
        {!membros.length ? (
          <p className="text-sm text-muted-foreground">Nenhum membro encontrado.</p>
        ) : (
          <div className="space-y-2">
            {membros.map((m) => (
              <article
                key={m.id_usuario}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-background p-3 transition-colors hover:bg-muted/40"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">{m.nome || "Usuário sem nome"}</p>
                  <p className="text-xs text-muted-foreground">{m.email || "Sem e-mail"}</p>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={m.cargo || "membro"}
                    onChange={(e) => onChangeCargo(m.id_usuario, e.target.value)}
                    disabled={!canManageMembros || savingMembroId === m.id_usuario}
                    className="rounded-lg border border-border bg-surface-elevated px-2 py-1.5 text-sm text-foreground disabled:opacity-60"
                  >
                    <option value="membro">Membro</option>
                    <option value="editor">Editor</option>
                    <option value="administrador">Administrador</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => onRemove(m)}
                    disabled={!canManageMembros || savingMembroId === m.id_usuario}
                    className="rounded-lg border border-red-400/70 px-2.5 py-1.5 text-xs font-medium text-red-800 hover:bg-red-100 disabled:opacity-60 dark:border-red-500/45 dark:text-red-300 dark:hover:bg-red-950/45"
                  >
                    Remover
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </EmpresaSectionPanel>
  );
}
