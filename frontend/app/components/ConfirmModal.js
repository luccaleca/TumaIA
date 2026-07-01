"use client";

import Modal from "./Modal";

const BTN_CANCEL =
  "rounded-lg border border-border bg-surface-elevated px-3 py-1.5 text-sm text-foreground hover:bg-muted disabled:opacity-50";

const BTN_DANGER =
  "rounded-lg border border-red-500/60 bg-red-100 px-3 py-1.5 text-sm font-medium text-red-900 hover:bg-red-200 disabled:opacity-50 dark:border-red-500/40 dark:bg-red-950/45 dark:font-normal dark:text-red-100 dark:hover:bg-red-950/65";

const BTN_PRIMARY =
  "rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground hover:opacity-90 disabled:opacity-50";

/**
 * Confirmação no estilo do painel (substitui `window.confirm` do navegador).
 */
export default function ConfirmModal({
  open,
  onClose,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  onConfirm,
  busy = false,
  variant = "danger",
}) {
  const confirmClass = variant === "primary" ? BTN_PRIMARY : BTN_DANGER;

  return (
    <Modal open={open} onClose={() => !busy && onClose?.()} title={title}>
      {typeof description === "string" ? (
        <p className="mt-2 text-sm text-foreground">{description}</p>
      ) : (
        <div className="mt-2 text-sm text-foreground">{description}</div>
      )}
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <button type="button" disabled={busy} onClick={onClose} className={BTN_CANCEL}>
          {cancelLabel}
        </button>
        <button type="button" disabled={busy} onClick={() => void onConfirm?.()} className={confirmClass}>
          {busy ? "…" : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
