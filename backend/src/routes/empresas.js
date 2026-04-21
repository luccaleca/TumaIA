import { Router } from "express";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { getSupabaseAdmin } from "../supabaseAdmin.js";
import { requireUserJwt } from "../middleware/requireUserJwt.js";
import { requireUsuario } from "../middleware/requireUsuario.js";

const r = Router();

r.use(requireUserJwt);
r.use(requireUsuario);

function db() {
  return getSupabaseAdmin();
}

/** Código legível, sem caracteres ambíguos (0/O, 1/I). */
function gerarCodigoConvite() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const buf = randomBytes(16);
  let s = "";
  for (let i = 0; i < 12; i++) s += chars[buf[i] % chars.length];
  return s;
}

function normalizarCodigo(raw) {
  return String(raw || "")
    .trim()
    .replace(/\s+/g, "")
    .toUpperCase();
}

const createEmpresaBody = z.object({
  nome_fantasia: z.string().min(1).max(200),
  razao_social: z.string().max(300).optional().nullable(),
  descricao: z.string().max(4000).optional().nullable(),
  instagram_empresa: z.string().max(200).optional().nullable(),
  telefone_principal: z.string().max(30).optional().nullable(),
  segmento: z.string().max(120).optional().nullable(),
  cnpj: z.string().max(20).optional().nullable(),
  email_principal: z.preprocess(
    (v) => (v === "" || v === undefined ? null : v),
    z.union([z.null(), z.string().email().max(200)]),
  ),
  nome_contato_principal: z.string().max(200).optional().nullable(),
  plano_codigo: z.enum(["nenhum", "teste_gratuito"]).optional(),
  plano_status: z
    .enum(["sem_plano", "trial", "ativo", "cancelado"])
    .optional(),
});

const createConviteBody = z.object({
  max_usos: z.number().int().min(1).max(1000).optional(),
  expira_em_dias: z.number().int().min(1).max(365).optional().nullable(),
});

const resgatarBody = z.object({
  codigo: z.string().min(4).max(64),
});

/**
 * Resgata um convite: vincula o usuário logado à empresa do convite.
 * (Rota fixa antes de /:idEmpresa para o Express não confundir "convites" com UUID.)
 */
r.post("/convites/resgatar", async (req, res) => {
  try {
    const parsed = resgatarBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const codigo = normalizarCodigo(parsed.data.codigo);
    if (codigo.length < 4) {
      res.status(400).json({ error: "Código inválido" });
      return;
    }

    const supabase = db();
    if (!supabase) {
      res.status(503).json({ error: "Supabase não configurado" });
      return;
    }

    const { data: conv, error: eC } = await supabase
      .from("empresa_convites")
      .select("*, empresas (*)")
      .eq("codigo", codigo)
      .eq("ativo", true)
      .maybeSingle();

    if (eC) {
      res.status(500).json({ error: eC.message });
      return;
    }

    if (!conv) {
      res.status(404).json({ error: "Convite não encontrado ou inativo" });
      return;
    }

    if (conv.expira_em && new Date(conv.expira_em) < new Date()) {
      res.status(410).json({ error: "Este convite expirou" });
      return;
    }

    if (conv.usos >= conv.max_usos) {
      res.status(410).json({ error: "Este convite já foi totalmente utilizado" });
      return;
    }

    let empresa = conv.empresas;
    if (!empresa) {
      const { data: empRow, error: eEmp } = await supabase
        .from("empresas")
        .select("*")
        .eq("id_empresa", conv.id_empresa)
        .maybeSingle();
      if (eEmp || !empRow) {
        res.status(500).json({ error: "Empresa do convite não encontrada" });
        return;
      }
      empresa = empRow;
    }

    const { data: jaMembro } = await supabase
      .from("empresa_membros")
      .select("papel")
      .eq("id_empresa", conv.id_empresa)
      .eq("id_usuario", req.usuario.id_usuario)
      .maybeSingle();

    if (jaMembro) {
      res.json({
        ja_membro: true,
        empresa,
        papel: jaMembro.papel,
        mensagem: "Você já faz parte desta empresa.",
      });
      return;
    }

    const { error: eIns } = await supabase.from("empresa_membros").insert({
      id_empresa: conv.id_empresa,
      id_usuario: req.usuario.id_usuario,
      papel: "membro",
    });

    if (eIns) {
      res.status(500).json({ error: eIns.message });
      return;
    }

    const novosUsos = conv.usos + 1;
    const esgotou = novosUsos >= conv.max_usos;

    const { data: updated, error: eUp } = await supabase
      .from("empresa_convites")
      .update({
        usos: novosUsos,
        ativo: !esgotou,
      })
      .eq("id_convite", conv.id_convite)
      .eq("usos", conv.usos)
      .select("id_convite")
      .maybeSingle();

    if (eUp || !updated) {
      await supabase
        .from("empresa_membros")
        .delete()
        .eq("id_empresa", conv.id_empresa)
        .eq("id_usuario", req.usuario.id_usuario)
        .eq("papel", "membro");
      res.status(500).json({ error: "Conflito ao registrar o convite. Tente de novo." });
      return;
    }

    res.status(201).json({
      empresa,
      papel: "membro",
      mensagem: `Você entrou em ${empresa.nome_fantasia || "empresa"}.`,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    console.error("empresas.resgatar:", e);
    if (!res.headersSent) res.status(500).json({ error: msg });
  }
});

/**
 * Lista empresas em que o usuário logado é membro.
 */
r.get("/minhas", async (req, res) => {
  try {
    const supabase = db();
    if (!supabase) {
      res.status(503).json({ error: "Supabase não configurado" });
      return;
    }

    const { data: membros, error: e1 } = await supabase
      .from("empresa_membros")
      .select("papel, id_empresa, empresas (*)")
      .eq("id_usuario", req.usuario.id_usuario);

    if (e1) {
      res.status(500).json({ error: e1.message });
      return;
    }

    const lista = (membros || []).map((m) => ({
      papel: m.papel,
      empresa: m.empresas,
    }));

    res.json({ empresas: lista });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    console.error("empresas.minhas:", e);
    if (!res.headersSent) res.status(500).json({ error: msg });
  }
});

/**
 * Cria empresa e já vincula o usuário atual como owner.
 */
r.post("/", async (req, res) => {
  try {
    const parsed = createEmpresaBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const supabase = db();
    if (!supabase) {
      res.status(503).json({ error: "Supabase não configurado" });
      return;
    }

    const b = parsed.data;
    const row = {
      nome_fantasia: b.nome_fantasia,
      razao_social: b.razao_social ?? null,
      descricao: b.descricao ?? null,
      instagram_empresa: b.instagram_empresa ?? null,
      telefone_principal: b.telefone_principal ?? null,
      segmento: b.segmento ?? null,
      cnpj: b.cnpj ?? null,
      email_principal: b.email_principal ?? null,
      nome_contato_principal: b.nome_contato_principal ?? null,
      plano_codigo: b.plano_codigo ?? "nenhum",
      plano_status: b.plano_status ?? "sem_plano",
    };

    const { data: emp, error: eEmp } = await supabase
      .from("empresas")
      .insert(row)
      .select("*")
      .single();

    if (eEmp) {
      res.status(500).json({ error: eEmp.message });
      return;
    }

    const { error: eMem } = await supabase.from("empresa_membros").insert({
      id_empresa: emp.id_empresa,
      id_usuario: req.usuario.id_usuario,
      papel: "owner",
    });

    if (eMem) {
      await supabase.from("empresas").delete().eq("id_empresa", emp.id_empresa);
      res.status(500).json({ error: eMem.message });
      return;
    }

    res.status(201).json({ empresa: emp });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    console.error("empresas.create:", e);
    if (!res.headersSent) res.status(500).json({ error: msg });
  }
});

/**
 * Cria um convite para a empresa (apenas owner ou admin).
 * O código é mostrado uma vez na resposta.
 */
r.post("/:idEmpresa/convites", async (req, res) => {
  try {
    const idEmpresa = z.string().uuid().safeParse(req.params.idEmpresa);
    if (!idEmpresa.success) {
      res.status(400).json({ error: "id_empresa inválido" });
      return;
    }

    const parsed = createConviteBody.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const supabase = db();
    if (!supabase) {
      res.status(503).json({ error: "Supabase não configurado" });
      return;
    }

    const { data: membro, error: eM } = await supabase
      .from("empresa_membros")
      .select("papel")
      .eq("id_empresa", idEmpresa.data)
      .eq("id_usuario", req.usuario.id_usuario)
      .maybeSingle();

    if (eM) {
      res.status(500).json({ error: eM.message });
      return;
    }

    if (!membro || (membro.papel !== "owner" && membro.papel !== "admin")) {
      res.status(403).json({ error: "Sem permissão para criar convites nesta empresa" });
      return;
    }

    let codigo = gerarCodigoConvite();
    for (let tentativa = 0; tentativa < 5; tentativa++) {
      const expira =
        parsed.data.expira_em_dias != null
          ? new Date(
              Date.now() + parsed.data.expira_em_dias * 24 * 60 * 60 * 1000,
            ).toISOString()
          : null;

      const insertRow = {
        id_empresa: idEmpresa.data,
        codigo,
        id_usuario_criador: req.usuario.id_usuario,
        expira_em: expira,
        max_usos: parsed.data.max_usos ?? 1,
        usos: 0,
        ativo: true,
      };

      const { data: conv, error: eC } = await supabase
        .from("empresa_convites")
        .insert(insertRow)
        .select("id_convite, codigo, expira_em, max_usos, criado_em")
        .single();

      if (!eC && conv) {
        res.status(201).json({
          convite: conv,
          mensagem:
            "Guarde o código com segurança. Ele não será exibido novamente nesta forma.",
        });
        return;
      }

      if (eC && !String(eC.message || "").includes("duplicate")) {
        res.status(500).json({ error: eC.message });
        return;
      }
      codigo = gerarCodigoConvite();
    }

    res.status(500).json({ error: "Não foi possível gerar um código único" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    console.error("empresas.createConvite:", e);
    if (!res.headersSent) res.status(500).json({ error: msg });
  }
});

export default r;
