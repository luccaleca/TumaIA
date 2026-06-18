import { handleImagePreview } from "../routes/ia.imagePreview.js";

/** Rotas internas: empresa já validada pelo mapeamento de telefone. */
async function assertEmpresaInternal() {
  return { ok: true };
}

/**
 * Executa `handleImagePreview` sem Express real (n8n / WhatsApp).
 * @param {import("@supabase/supabase-js").SupabaseClient} db
 * @param {Record<string, unknown>} body
 */
export async function runImagePreviewInternal(db, body) {
  return new Promise((resolve) => {
    const req = { body };
    const res = {
      statusCode: 200,
      headersSent: false,
      status(code) {
        this.statusCode = code;
        return this;
      },
      set() {
        return this;
      },
      json(data) {
        const ok = this.statusCode >= 200 && this.statusCode < 300;
        resolve({
          ok,
          status: this.statusCode,
          data: ok ? data : undefined,
          error: ok ? undefined : data?.error || "Erro ao gerar imagem",
        });
      },
    };
    void handleImagePreview(req, res, db, assertEmpresaInternal);
  });
}
