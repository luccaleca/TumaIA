/**
 * Proteção das mensagens que chegam pelo webhook do WhatsApp.
 *
 * A Meta guarda eventos que falharam e os reentrega depois (até dias), e também pode repetir
 * o mesmo evento. Sem filtro, o bot responderia de novo a mensagens velhas ou repetidas.
 * Aqui descartamos as duas coisas; o webhook segue respondendo 200 para a Meta esquecer o evento.
 */

const UM_DIA_MS = 24 * 60 * 60 * 1000;

/**
 * @param {{
 *   maxAgeMs?: number,
 *   ttlMs?: number,
 *   maxEntries?: number,
 *   now?: () => number,
 * }} [opts]  maxAgeMs <= 0 desliga o filtro de idade.
 */
export function createInboundGuard(opts = {}) {
  const maxAgeMs = Number.isFinite(opts.maxAgeMs) ? Number(opts.maxAgeMs) : 10 * 60 * 1000;
  const ttlMs = opts.ttlMs ?? UM_DIA_MS;
  const maxEntries = opts.maxEntries ?? 2000;
  const now = opts.now ?? Date.now;
  /** @type {Map<string, number>} id da mensagem -> quando deixa de valer */
  const vistos = new Map();

  function limpar(agora) {
    for (const [id, expira] of vistos) {
      if (expira <= agora) vistos.delete(id);
    }
    // Map mantém a ordem de inserção: se ainda passar do limite, sai o mais antigo.
    while (vistos.size > maxEntries) {
      const maisAntigo = vistos.keys().next().value;
      vistos.delete(maisAntigo);
    }
  }

  return {
    /**
     * @param {{ message_id?: string | null, timestamp?: string | number | null }} msg
     * @returns {{ ok: true } | { ok: false, reason: "stale" | "duplicate", idadeMs?: number }}
     */
    check(msg) {
      const agora = now();

      const segundos = Number(msg?.timestamp);
      if (maxAgeMs > 0 && Number.isFinite(segundos) && segundos > 0) {
        const idadeMs = agora - segundos * 1000;
        if (idadeMs > maxAgeMs) return { ok: false, reason: "stale", idadeMs };
      }

      const id = String(msg?.message_id ?? "").trim();
      if (id) {
        limpar(agora);
        if (vistos.has(id)) return { ok: false, reason: "duplicate" };
        vistos.set(id, agora + ttlMs);
      }
      return { ok: true };
    },
  };
}
