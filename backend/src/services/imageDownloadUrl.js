/**
 * Hostnames permitidos para proxy de download (evita SSRF).
 * @param {string} urlString
 */
export function isAllowedImageDownloadUrl(urlString) {
  try {
    const u = new URL(String(urlString || "").trim());
    if (u.protocol !== "https:") return false;
    const h = u.hostname.toLowerCase();
    if (h === "replicate.delivery" || h.endsWith(".replicate.delivery")) return true;
    if (h.endsWith(".r2.cloudflarestorage.com")) return true;
    if (h.endsWith(".supabase.co") && u.pathname.includes("/storage/")) return true;
    return false;
  } catch {
    return false;
  }
}

/**
 * @param {string} urlString
 */
export function guessImageDownloadFilename(urlString) {
  try {
    const u = new URL(urlString);
    const base = u.pathname.split("/").pop() || "";
    if (/\.(png|jpe?g|webp)$/i.test(base)) return base.replace(/[^\w.\-]/g, "_");
  } catch {
    /* ignore */
  }
  return `tuma-arte-${Date.now()}.png`;
}
