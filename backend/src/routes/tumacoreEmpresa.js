import { Router } from "express";
import { requireUserJwt } from "../middleware/requireUserJwt.js";
import { requireUsuario } from "../middleware/requireUsuario.js";
import { requireTumaCoreEmpresa } from "../middleware/requireTumaCoreEmpresa.js";
import { loadEmpresaDashboard } from "../modules/tumacore/empresaDashboardService.js";
import { loadEmpresaAnalytics } from "../modules/tumacore/empresaAnalyticsService.js";

const r = Router();

r.use(requireUserJwt);
r.use(requireUsuario);
r.use(requireTumaCoreEmpresa);

function sendError(res, e, fallback) {
  const status = Number(e?.status) || 500;
  res.status(status).json({
    error: e instanceof Error ? e.message : fallback,
  });
}

/**
 * GET /tumacore/empresa/dashboard?period=1|7|30
 * id_empresa vem só de req.tumacoreEmpresa (backend).
 */
r.get("/dashboard", async (req, res) => {
  try {
    const data = await loadEmpresaDashboard({
      id_empresa: req.tumacoreEmpresa.id_empresa,
      period: req.query.period,
      from: req.query.from,
      to: req.query.to,
    });
    res.json(data);
  } catch (e) {
    sendError(res, e, "Falha ao carregar dashboard da empresa");
  }
});

/**
 * GET /tumacore/empresa/analytics?period=1|7|30
 */
r.get("/analytics", async (req, res) => {
  try {
    const data = await loadEmpresaAnalytics({
      id_empresa: req.tumacoreEmpresa.id_empresa,
      period: req.query.period,
      from: req.query.from,
      to: req.query.to,
    });
    res.json(data);
  } catch (e) {
    sendError(res, e, "Falha ao carregar analytics da empresa");
  }
});

export default r;
