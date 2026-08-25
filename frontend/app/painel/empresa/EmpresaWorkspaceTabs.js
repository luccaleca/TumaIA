const TABS = [
  { id: "visao", label: "Visão geral" },
  { id: "marca", label: "Marca" },
  { id: "equipe", label: "Equipe" },
];

/**
 * @param {{
 *   value: 'visao' | 'marca' | 'equipe',
 *   onChange: (id: 'visao' | 'marca' | 'equipe') => void,
 * }} props
 */
export default function EmpresaWorkspaceTabs({ value, onChange }) {
  return (
    <div
      className="mt-4 flex gap-1 border-b border-border"
      role="tablist"
      aria-label="Áreas da empresa"
    >
      {TABS.map((tab) => {
        const active = value === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            id={`empresa-tab-${tab.id}`}
            onClick={() => onChange(tab.id)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              active
                ? "border-accent text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
