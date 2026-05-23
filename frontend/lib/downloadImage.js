import { getApiBase, loadToken } from "./auth";

function triggerBlobDownload(blob, filename) {
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(href);
}

/**
 * Baixa imagem gerada via proxy autenticado do backend.
 *
 * @param {string} imageUrl
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
export async function downloadGeneratedImage(imageUrl) {
  const url = String(imageUrl || "").trim();
  if (!url) return { ok: false, error: "URL inválida." };

  const token = loadToken();
  if (!token) return { ok: false, error: "Sessão não encontrada." };

  const api = `${getApiBase()}/ia/image-download?url=${encodeURIComponent(url)}`;
  try {
    const res = await fetch(api, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      let msg = "Não foi possível baixar a imagem.";
      try {
        const j = await res.json();
        if (j?.error) msg = String(j.error);
      } catch {
        /* ignore */
      }
      return { ok: false, error: msg };
    }
    const blob = await res.blob();
    const disp = res.headers.get("Content-Disposition") || "";
    const m = /filename="?([^";]+)"?/i.exec(disp);
    const filename = m?.[1]?.trim() || `tuma-arte-${Date.now()}.png`;
    triggerBlobDownload(blob, filename);
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Erro ao baixar a imagem.",
    };
  }
}
