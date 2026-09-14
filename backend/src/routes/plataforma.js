import { Router } from "express";
import { z } from "zod";
import { requireUserJwt } from "../middleware/requireUserJwt.js";
import { requireUsuario } from "../middleware/requireUsuario.js";
import { requireDonoPlataforma } from "../middleware/requireDonoPlataforma.js";
import { loadPlataformaDashboard } from "../modules/plataforma/dashboardService.js";
import {
  loadPlataformaClienteDetalhe,
  loadPlataformaClientes,
} from "../modules/plataforma/clientesService.js";
import { loadPlataformaAnalytics } from "../modules/plataforma/analyticsService.js";
import { listSqlPresets, runSqlPreset } from "../modules/plataforma/sqlPresets.js";
import {
  processChatSqlMessage,
  SUGESTOES_CHAT_SQL,
} from "../modules/plataforma/chatSqlService.js";

const r = Router();

r.use(requireUserJwt);
r.use(requireUsuario);
r.use(requireDonoPlataforma);

function sendError(res, e, fallback) {
  const status = Number(e?.status) || 500;
  res.status(status).json({
    error: e instanceof Error ? e.message : fallback,
  });
}

/**
 * GET /plataforma/dashboard?period=1|7|30
 */
r.get("/dashboard", async (req, res) => {
  try {
    const data = await loadPlataformaDashboard({
      period: req.query.period,
      from: req.query.from,
      to: req.query.to,
    });
    res.json(data);
  } catch (e) {
    sendError(res, e, "Falha ao carregar dashboard");
  }
});

/**
 * GET /plataforma/clientes?period=&filtro=todos|ativos|inativos|sem_atividade
 */
r.get("/clientes", async (req, res) => {
  try {
    const data = await loadPlataformaClientes({
      period: req.query.period,
      from: req.query.from,
      to: req.query.to,
      filtro: req.query.filtro,
      q: req.query.q,
    });
    res.json(data);
  } catch (e) {
    sendError(res, e, "Falha ao listar clientes");
  }
});

/**
 * GET /plataforma/clientes/:idEmpresa
 */
r.get("/clientes/:idEmpresa", async (req, res) => {
  try {
    const id = z.string().uuid().safeParse(req.params.idEmpresa);
    if (!id.success) {
      res.status(400).json({ error: "id_empresa inválido" });
      return;
    }
    const data = await loadPlataformaClienteDetalhe(id.data, {
      period: req.query.period,
      from: req.query.from,
      to: req.query.to,
    });
    res.json(data);
  } catch (e) {
    sendError(res, e, "Falha ao carregar cliente");
  }
});

/**
 * GET /plataforma/analytics?period=1|7|30
 */
r.get("/analytics", async (req, res) => {
  try {
    const data = await loadPlataformaAnalytics({
      period: req.query.period,
      from: req.query.from,
      to: req.query.to,
    });
    res.json(data);
  } catch (e) {
    sendError(res, e, "Falha ao carregar analytics");
  }
});

/**
 * GET /plataforma/sql/presets
 */
r.get("/sql/presets", (_req, res) => {
  res.json(listSqlPresets());
});

/**
 * POST /plataforma/sql/preset  { id, period? }
 */
r.post("/sql/preset", async (req, res) => {
  try {
    const body = z
      .object({
        id: z.string().min(1).max(64),
        period: z.union([z.string(), z.number()]).optional(),
        from: z.string().optional(),
        to: z.string().optional(),
      })
      .safeParse(req.body || {});
    if (!body.success) {
      res.status(400).json({ error: "Informe o id da consulta" });
      return;
    }
    const data = await runSqlPreset(body.data.id, {
      period: body.data.period ?? req.query.period,
      from: body.data.from,
      to: body.data.to,
    });
    res.json(data);
  } catch (e) {
    sendError(res, e, "Falha ao executar consulta");
  }
});

/**
 * GET /plataforma/chat-sql/sugestoes
 */
r.get("/chat-sql/sugestoes", (_req, res) => {
  res.json({ sugestoes: SUGESTOES_CHAT_SQL });
});

/**
 * POST /plataforma/chat-sql  { message, history? }
 */
r.post("/chat-sql", async (req, res) => {
  try {
    const body = z
      .object({
        message: z.string().min(1).max(2000),
        history: z
          .array(
            z.object({
              role: z.string(),
              content: z.string(),
            }),
          )
          .optional(),
      })
      .safeParse(req.body || {});
    if (!body.success) {
      res.status(400).json({ error: "Informe a mensagem do Chat SQL" });
      return;
    }
    const data = await processChatSqlMessage(body.data);
    res.json(data);
  } catch (e) {
    sendError(res, e, "Falha ao processar mensagem no Chat SQL");
  }
});

export default r;
