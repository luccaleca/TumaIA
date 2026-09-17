/**
 * Modelos de post / contextos de campanha foram descontinuados.
 * Rotas mantidas só para clientes antigos receberem 410.
 */
const REMOVED_MSG =
  "Modelos de post foram removidos. Use identidade da marca, mídias do acervo e o pedido no chat.";

function gone(_req, res) {
  res.status(410).json({ error: REMOVED_MSG });
}

export function registerContextosRoutes(r) {
  r.get("/:idEmpresa/contextos", gone);
  r.post("/:idEmpresa/contextos", gone);
  r.patch("/:idEmpresa/contextos/:idContexto", gone);
  r.delete("/:idEmpresa/contextos/:idContexto", gone);
  r.get("/:idEmpresa/modelos-post", gone);
  r.patch("/:idEmpresa/modelos-post/:slug", gone);
}
