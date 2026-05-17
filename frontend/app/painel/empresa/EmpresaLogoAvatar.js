function iniciaisEmpresa(nome) {
  const parts = String(nome || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
  }
  return (parts[0]?.slice(0, 2) || "?").toUpperCase();
}

const SIZES = {
  sm: {
    box: "h-14 w-14 rounded-xl",
    text: "text-sm",
    icon: "h-6 w-6",
  },
  md: {
    box: "h-[4.75rem] w-[4.75rem] rounded-2xl sm:h-20 sm:w-20",
    text: "text-lg",
    icon: "h-7 w-7",
  },
  lg: {
    box: "h-24 w-24 rounded-2xl sm:h-[5.5rem] sm:w-[5.5rem]",
    text: "text-xl",
    icon: "h-8 w-8",
  },
};

function BuildingIcon({ className }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className={className}
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-4h6v4M9 11h1M14 11h1M9 15h1M14 15h1"
      />
    </svg>
  );
}

export default function EmpresaLogoAvatar({ fotoUrl, nome, size = "md", className = "" }) {
  const s = SIZES[size] || SIZES.md;
  const url = fotoUrl ? String(fotoUrl).trim() : "";
  const iniciais = iniciaisEmpresa(nome);

  return (
    <div
      className={`relative shrink-0 overflow-hidden shadow-[0_2px_14px_rgba(15,23,42,0.08)] ring-1 ring-black/[0.05] dark:shadow-[0_2px_14px_rgba(0,0,0,0.35)] dark:ring-white/[0.08] ${url ? "" : "bg-surface dark:bg-surface-elevated"} ${s.box} ${className}`}
    >
      {url ? (
        <img src={url} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-muted/90 to-muted/40">
          {iniciais.length >= 2 && iniciais !== "?" ? (
            <span className={`font-semibold tracking-tight text-accent ${s.text}`}>{iniciais}</span>
          ) : (
            <BuildingIcon className={`text-muted-foreground/50 ${s.icon}`} />
          )}
        </div>
      )}
    </div>
  );
}
