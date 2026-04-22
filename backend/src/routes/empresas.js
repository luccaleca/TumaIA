import { Router } from "express";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { z } from "zod";
import { getSupabaseAdmin } from "../supabaseAdmin.js";
import { requireUserJwt } from "../middleware/requireUserJwt.js";
import { requireUsuario } from "../middleware/requireUsuario.js";
import { env } from "../config.js";

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
});

const updateEmpresaBody = createEmpresaBody
  .partial()
  .refine((d) => Object.keys(d).length > 0, {
    message: "Informe ao menos um campo para atualizar",
  });

const createConviteBody = z.object({
  max_usos: z.number().int().min(1).max(1).optional(),
  expira_em_dias: z.number().int().min(1).max(365).optional().nullable(),
  email_destino: z.string().email().max(255).optional().nullable(),
  cargo: z
    .enum(["membro", "editor", "administrador"])
    .optional(),
  perfil_acesso: z
    .enum(["observador", "editor", "administrador"])
    .optional(),
  responsavel_operacional: z.boolean().optional(),
  receber_alertas: z.boolean().optional(),
});

const resgatarBody = z.object({
  codigo: z.string().min(4).max(64),
});
const membroParam = z.object({
  idEmpresa: z.string().uuid(),
  idUsuario: z.string().uuid(),
});
const patchMembroBody = z.object({
  cargo: z.enum(["membro", "editor", "administrador"]),
});
const createPastaBody = z.object({
  nome: z.string().min(1).max(120),
  id_pasta_pai: z.string().uuid().nullable().optional(),
});
const uploadMidiaBody = z.object({
  /** Se omitido, usa a pasta padrão da raiz (upload sem entrar em subpasta). */
  id_pasta: z.string().uuid().nullish(),
  nome_arquivo: z.string().min(1).max(260),
  nome_exibicao: z.string().min(1).max(200).optional(),
  tipo_midia: z.enum(["imagem", "video"]),
  mime_type: z.string().min(3).max(120),
  base64_data: z.string().min(10),
  descricao: z.string().max(1000).optional().nullable(),
  alt_text: z.string().max(1000).optional().nullable(),
});
const midiaParam = z.object({
  idEmpresa: z.string().uuid(),
  idMidia: z.string().uuid(),
});
const pastaParam = z.object({
  idEmpresa: z.string().uuid(),
  idPasta: z.string().uuid(),
});
const patchPastaBody = z
  .object({
    id_pasta_pai: z.string().uuid().nullable().optional(),
    nome: z.string().min(1).max(120).optional(),
  })
  .refine((d) => d.id_pasta_pai !== undefined || d.nome !== undefined, {
    message: "Informe id_pasta_pai ou nome",
  });
const patchMidiaBody = z
  .object({
    id_pasta: z.string().uuid().optional(),
    nome_exibicao: z.string().min(1).max(200).optional(),
  })
  .refine((d) => d.id_pasta !== undefined || d.nome_exibicao !== undefined, {
    message: "Informe id_pasta ou nome_exibicao",
  });

function perfilAcessoPorCargo(cargo) {
  if (cargo === "administrador") return "administrador";
  return "editor";
}

const MEDIA_BUCKET = env.MEDIA_BUCKET || "midias";

async function getMembroAtivoEmpresa(supabase, idEmpresa, idUsuario) {
  const { data, error } = await supabase
    .from("usuarios_empresa")
    .select("id_usuario, cargo, ativo")
    .eq("id_empresa", idEmpresa)
    .eq("id_usuario", idUsuario)
    .eq("ativo", true)
    .maybeSingle();
  return { data, error };
}

function podeGerenciarMidias(cargo) {
  return cargo === "administrador" || cargo === "editor";
}

/** IDs de todas as subpastas (não inclui `rootId`). */
function coletarSubpastas(allPastas, rootId) {
  const descendants = new Set();
  const queue = [rootId];
  while (queue.length) {
    const id = queue.shift();
    for (const row of allPastas) {
      if (row.id_pasta_pai === id && row.id_pasta) {
        descendants.add(row.id_pasta);
        queue.push(row.id_pasta);
      }
    }
  }
  return descendants;
}

function safeExt(filename) {
  const ext = path.extname(filename || "").toLowerCase().replace(/^\./, "");
  return ext || "bin";
}

/** Nome reservado: pasta na raiz para mídias “soltos” (usuário não precisa criar pastas). */
const PASTA_UPLOAD_RAIZ_NOME = "Geral";

async function getOrCreatePastaUploadRaiz(supabase, idEmpresa) {
  const { data: found, error: eFind } = await supabase
    .from("pastas")
    .select("id_pasta")
    .eq("id_empresa", idEmpresa)
    .is("id_pasta_pai", null)
    .eq("nome", PASTA_UPLOAD_RAIZ_NOME)
    .eq("ativo", true)
    .maybeSingle();
  if (eFind) throw new Error(eFind.message);
  if (found?.id_pasta) return found.id_pasta;

  const { data: created, error: eIns } = await supabase
    .from("pastas")
    .insert({
      id_empresa: idEmpresa,
      id_pasta_pai: null,
      nome: PASTA_UPLOAD_RAIZ_NOME,
      ativo: true,
    })
    .select("id_pasta")
    .single();

  if (eIns) {
    const msg = String(eIns.message || "");
    if (/duplicate|unique/i.test(msg)) {
      const { data: again, error: e2 } = await supabase
        .from("pastas")
        .select("id_pasta")
        .eq("id_empresa", idEmpresa)
        .is("id_pasta_pai", null)
        .eq("nome", PASTA_UPLOAD_RAIZ_NOME)
        .eq("ativo", true)
        .maybeSingle();
      if (e2) throw new Error(e2.message);
      if (again?.id_pasta) return again.id_pasta;
    }
    throw new Error(eIns.message);
  }
  return created.id_pasta;
}

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

    if (conv.data_expiracao && new Date(conv.data_expiracao) < new Date()) {
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
      .from("usuarios_empresa")
      .select(
        "id, cargo, perfil_acesso, responsavel_operacional, receber_alertas, ativo",
      )
      .eq("id_empresa", conv.id_empresa)
      .eq("id_usuario", req.usuario.id_usuario)
      .maybeSingle();

    if (jaMembro?.ativo) {
      res.json({
        ja_membro: true,
        empresa,
        papel: jaMembro.cargo,
        mensagem: "Você já faz parte desta empresa.",
      });
      return;
    }
    const membroPayload = {
      id_empresa: conv.id_empresa,
      id_usuario: req.usuario.id_usuario,
      cargo: conv.cargo || "membro",
      perfil_acesso: conv.perfil_acesso || "editor",
      responsavel_operacional: !!conv.responsavel_operacional,
      receber_alertas: conv.receber_alertas !== false,
      ativo: true,
    };

    if (jaMembro) {
      const { error: eUpM } = await supabase
        .from("usuarios_empresa")
        .update(membroPayload)
        .eq("id", jaMembro.id);
      if (eUpM) {
        res.status(500).json({ error: eUpM.message });
        return;
      }
    } else {
      const { error: eIns } = await supabase
        .from("usuarios_empresa")
        .insert(membroPayload);
      if (eIns) {
        res.status(500).json({ error: eIns.message });
        return;
      }
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
        .from("usuarios_empresa")
        .delete()
        .eq("id_empresa", conv.id_empresa)
        .eq("id_usuario", req.usuario.id_usuario);
      res.status(500).json({ error: "Conflito ao registrar o convite. Tente de novo." });
      return;
    }

    res.status(201).json({
      empresa,
      papel: membroPayload.cargo,
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
      .from("usuarios_empresa")
      .select("cargo, perfil_acesso, responsavel_operacional, receber_alertas, id_empresa, empresas (*)")
      .eq("id_usuario", req.usuario.id_usuario)
      .eq("ativo", true);

    if (e1) {
      res.status(500).json({ error: e1.message });
      return;
    }

    const lista = (membros || []).map((m) => ({
      papel: m.cargo,
      perfil_acesso: m.perfil_acesso,
      responsavel_operacional: !!m.responsavel_operacional,
      receber_alertas: !!m.receber_alertas,
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
 * Atualiza dados cadastrais da empresa (administrador ou editor).
 */
r.patch("/:idEmpresa", async (req, res) => {
  try {
    const idEmpresa = z.string().uuid().safeParse(req.params.idEmpresa);
    if (!idEmpresa.success) {
      res.status(400).json({ error: "id_empresa inválido" });
      return;
    }

    const parsed = updateEmpresaBody.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const supabase = db();
    if (!supabase) {
      res.status(503).json({ error: "Supabase não configurado" });
      return;
    }

    const { data: membro, error: ePerm } = await getMembroAtivoEmpresa(
      supabase,
      idEmpresa.data,
      req.usuario.id_usuario,
    );

    if (ePerm) {
      res.status(500).json({ error: ePerm.message });
      return;
    }
    if (!membro || !podeGerenciarMidias(membro.cargo)) {
      res.status(403).json({ error: "Sem permissão para editar os dados desta empresa" });
      return;
    }

    const b = parsed.data;
    const row = {};
    if (b.nome_fantasia !== undefined) row.nome_fantasia = b.nome_fantasia;
    if (b.razao_social !== undefined) row.razao_social = b.razao_social ?? null;
    if (b.descricao !== undefined) row.descricao = b.descricao ?? null;
    if (b.instagram_empresa !== undefined) row.instagram_empresa = b.instagram_empresa ?? null;
    if (b.telefone_principal !== undefined) row.telefone_principal = b.telefone_principal ?? null;
    if (b.segmento !== undefined) row.segmento = b.segmento ?? null;
    if (b.cnpj !== undefined) row.cnpj = b.cnpj ?? null;
    if (b.email_principal !== undefined) row.email_principal = b.email_principal ?? null;
    if (b.nome_contato_principal !== undefined) {
      row.nome_contato_principal = b.nome_contato_principal ?? null;
    }

    const { data: updated, error: eUp } = await supabase
      .from("empresas")
      .update(row)
      .eq("id_empresa", idEmpresa.data)
      .select("*")
      .maybeSingle();

    if (eUp) {
      const msg = String(eUp.message || "");
      if (/duplicate|unique/i.test(msg) && /cnpj/i.test(msg)) {
        res.status(409).json({ error: "Já existe outra empresa com este CNPJ." });
        return;
      }
      res.status(500).json({ error: eUp.message });
      return;
    }
    if (!updated) {
      res.status(404).json({ error: "Empresa não encontrada" });
      return;
    }

    res.json({ empresa: updated });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    console.error("empresas.patchEmpresa:", e);
    if (!res.headersSent) res.status(500).json({ error: msg });
  }
});

/**
 * Lista membros de uma empresa (apenas para membros ativos da própria empresa).
 */
r.get("/:idEmpresa/membros", async (req, res) => {
  try {
    const idEmpresa = z.string().uuid().safeParse(req.params.idEmpresa);
    if (!idEmpresa.success) {
      res.status(400).json({ error: "id_empresa inválido" });
      return;
    }

    const supabase = db();
    if (!supabase) {
      res.status(503).json({ error: "Supabase não configurado" });
      return;
    }

    const { data: membroAtual, error: ePerm } = await supabase
      .from("usuarios_empresa")
      .select("id")
      .eq("id_empresa", idEmpresa.data)
      .eq("id_usuario", req.usuario.id_usuario)
      .eq("ativo", true)
      .maybeSingle();

    if (ePerm) {
      res.status(500).json({ error: ePerm.message });
      return;
    }

    if (!membroAtual) {
      res.status(403).json({ error: "Sem permissão para listar membros desta empresa" });
      return;
    }

    const { data: membros, error: eList } = await supabase
      .from("usuarios_empresa")
      .select(
        "id_usuario, cargo, perfil_acesso, responsavel_operacional, receber_alertas, ativo, usuarios (nome, email)",
      )
      .eq("id_empresa", idEmpresa.data)
      .eq("ativo", true);

    if (eList) {
      res.status(500).json({ error: eList.message });
      return;
    }

    const lista = (membros || []).map((m) => ({
      id_usuario: m.id_usuario,
      nome: m.usuarios?.nome ?? null,
      email: m.usuarios?.email ?? null,
      cargo: m.cargo,
      perfil_acesso: m.perfil_acesso,
      responsavel_operacional: !!m.responsavel_operacional,
      receber_alertas: !!m.receber_alertas,
      ativo: !!m.ativo,
    }));

    res.json({ membros: lista });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    console.error("empresas.membros:", e);
    if (!res.headersSent) res.status(500).json({ error: msg });
  }
});

/**
 * Lista pastas da empresa.
 */
r.get("/:idEmpresa/pastas", async (req, res) => {
  try {
    const idEmpresa = z.string().uuid().safeParse(req.params.idEmpresa);
    if (!idEmpresa.success) {
      res.status(400).json({ error: "id_empresa inválido" });
      return;
    }
    const supabase = db();
    if (!supabase) {
      res.status(503).json({ error: "Supabase não configurado" });
      return;
    }
    const { data: membro, error: ePerm } = await getMembroAtivoEmpresa(
      supabase,
      idEmpresa.data,
      req.usuario.id_usuario,
    );
    if (ePerm) {
      res.status(500).json({ error: ePerm.message });
      return;
    }
    if (!membro) {
      res.status(403).json({ error: "Sem permissão para acessar pastas desta empresa" });
      return;
    }

    const { data: pastas, error: eList } = await supabase
      .from("pastas")
      .select("*")
      .eq("id_empresa", idEmpresa.data)
      .eq("ativo", true)
      .order("nome", { ascending: true });
    if (eList) {
      res.status(500).json({ error: eList.message });
      return;
    }
    let idPastaUploadRaiz;
    try {
      idPastaUploadRaiz = await getOrCreatePastaUploadRaiz(supabase, idEmpresa.data);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao garantir pasta da raiz";
      res.status(500).json({ error: msg });
      return;
    }
    res.json({
      pastas: pastas || [],
      id_pasta_upload_raiz: idPastaUploadRaiz,
      pasta_upload_raiz_nome: PASTA_UPLOAD_RAIZ_NOME,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    console.error("empresas.listPastas:", e);
    if (!res.headersSent) res.status(500).json({ error: msg });
  }
});

/**
 * Cria pasta de mídia (admin/editor).
 */
r.post("/:idEmpresa/pastas", async (req, res) => {
  try {
    const idEmpresa = z.string().uuid().safeParse(req.params.idEmpresa);
    if (!idEmpresa.success) {
      res.status(400).json({ error: "id_empresa inválido" });
      return;
    }
    const parsed = createPastaBody.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const supabase = db();
    if (!supabase) {
      res.status(503).json({ error: "Supabase não configurado" });
      return;
    }
    const { data: membro, error: ePerm } = await getMembroAtivoEmpresa(
      supabase,
      idEmpresa.data,
      req.usuario.id_usuario,
    );
    if (ePerm) {
      res.status(500).json({ error: ePerm.message });
      return;
    }
    if (!membro || !podeGerenciarMidias(membro.cargo)) {
      res.status(403).json({ error: "Sem permissão para criar pasta" });
      return;
    }

    const row = {
      id_empresa: idEmpresa.data,
      id_pasta_pai: parsed.data.id_pasta_pai ?? null,
      nome: parsed.data.nome.trim(),
      ativo: true,
    };
    const { data: created, error: eCreate } = await supabase
      .from("pastas")
      .insert(row)
      .select("*")
      .single();
    if (eCreate) {
      const msg = String(eCreate.message || "");
      if (/duplicate|unique/i.test(msg)) {
        res.status(409).json({ error: "Já existe uma pasta com esse nome nesse nível" });
        return;
      }
      res.status(500).json({ error: eCreate.message });
      return;
    }
    res.status(201).json({ pasta: created });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    console.error("empresas.createPasta:", e);
    if (!res.headersSent) res.status(500).json({ error: msg });
  }
});

/**
 * Atualiza pasta: mover (id_pasta_pai), renomear (nome) ou ambos. Admin/editor.
 */
r.patch("/:idEmpresa/pastas/:idPasta", async (req, res) => {
  try {
    const p = pastaParam.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ error: p.error.flatten() });
      return;
    }
    const parsed = patchPastaBody.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const supabase = db();
    if (!supabase) {
      res.status(503).json({ error: "Supabase não configurado" });
      return;
    }
    const { data: membro, error: ePerm } = await getMembroAtivoEmpresa(
      supabase,
      p.data.idEmpresa,
      req.usuario.id_usuario,
    );
    if (ePerm) {
      res.status(500).json({ error: ePerm.message });
      return;
    }
    if (!membro || !podeGerenciarMidias(membro.cargo)) {
      res.status(403).json({ error: "Sem permissão para alterar pasta" });
      return;
    }

    const { data: pastaRow, error: eFind } = await supabase
      .from("pastas")
      .select("id_pasta, id_empresa, id_pasta_pai, nome, ativo")
      .eq("id_pasta", p.data.idPasta)
      .eq("id_empresa", p.data.idEmpresa)
      .eq("ativo", true)
      .maybeSingle();
    if (eFind) {
      res.status(500).json({ error: eFind.message });
      return;
    }
    if (!pastaRow) {
      res.status(404).json({ error: "Pasta não encontrada" });
      return;
    }

    const curPai = pastaRow.id_pasta_pai ?? null;
    const wantPai = parsed.data.id_pasta_pai;
    const wantNomeIn = parsed.data.nome;
    const destPai = wantPai !== undefined ? wantPai : curPai;
    const destNome = wantNomeIn !== undefined ? wantNomeIn.trim() : pastaRow.nome;

    if (
      pastaRow.nome === PASTA_UPLOAD_RAIZ_NOME &&
      pastaRow.id_pasta_pai == null &&
      wantNomeIn !== undefined &&
      destNome !== PASTA_UPLOAD_RAIZ_NOME
    ) {
      res.status(400).json({
        error: `A pasta "${PASTA_UPLOAD_RAIZ_NOME}" na raiz não pode ser renomeada.`,
      });
      return;
    }

    const mudouPai = wantPai !== undefined && destPai !== curPai;
    const mudouNome = wantNomeIn !== undefined && destNome !== pastaRow.nome;

    if (!mudouPai && !mudouNome) {
      res.json({ pasta: pastaRow });
      return;
    }

    async function conflitoNomeEm(nomeChecar, idPastaPaiDest, excetoId) {
      let q = supabase
        .from("pastas")
        .select("id_pasta")
        .eq("id_empresa", p.data.idEmpresa)
        .eq("nome", nomeChecar)
        .eq("ativo", true)
        .neq("id_pasta", excetoId);
      q = idPastaPaiDest === null ? q.is("id_pasta_pai", null) : q.eq("id_pasta_pai", idPastaPaiDest);
      const { data: c } = await q.maybeSingle();
      return !!c;
    }

    if (!mudouPai && mudouNome) {
      if (await conflitoNomeEm(destNome, curPai, p.data.idPasta)) {
        res.status(409).json({ error: "Já existe uma pasta com esse nome nesse nível" });
        return;
      }
      const { data: atualizada, error: eUp } = await supabase
        .from("pastas")
        .update({
          nome: destNome,
          data_atualizacao: new Date().toISOString(),
        })
        .eq("id_pasta", p.data.idPasta)
        .eq("id_empresa", p.data.idEmpresa)
        .select("*")
        .single();
      if (eUp) {
        res.status(500).json({ error: eUp.message });
        return;
      }
      res.json({ pasta: atualizada });
      return;
    }

    const novoPai = destPai;
    if (novoPai === p.data.idPasta) {
      res.status(400).json({ error: "Uma pasta não pode ser pai dela mesma" });
      return;
    }

    if (novoPai) {
      const { data: paiRow, error: ePai } = await supabase
        .from("pastas")
        .select("id_pasta")
        .eq("id_pasta", novoPai)
        .eq("id_empresa", p.data.idEmpresa)
        .eq("ativo", true)
        .maybeSingle();
      if (ePai) {
        res.status(500).json({ error: ePai.message });
        return;
      }
      if (!paiRow) {
        res.status(400).json({ error: "Pasta de destino inválida" });
        return;
      }
      const { data: todas, error: eTodas } = await supabase
        .from("pastas")
        .select("id_pasta, id_pasta_pai")
        .eq("id_empresa", p.data.idEmpresa)
        .eq("ativo", true);
      if (eTodas) {
        res.status(500).json({ error: eTodas.message });
        return;
      }
      const sub = coletarSubpastas(todas || [], p.data.idPasta);
      if (sub.has(novoPai)) {
        res.status(400).json({ error: "Não é possível mover uma pasta para dentro dela mesma" });
        return;
      }
    }

    if (await conflitoNomeEm(destNome, novoPai, p.data.idPasta)) {
      res.status(409).json({ error: "Já existe uma pasta com esse nome nesse nível" });
      return;
    }

    const { data: atualizada, error: eUp } = await supabase
      .from("pastas")
      .update({
        id_pasta_pai: novoPai,
        nome: destNome,
        data_atualizacao: new Date().toISOString(),
      })
      .eq("id_pasta", p.data.idPasta)
      .eq("id_empresa", p.data.idEmpresa)
      .select("*")
      .single();
    if (eUp) {
      res.status(500).json({ error: eUp.message });
      return;
    }
    res.json({ pasta: atualizada });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    console.error("empresas.patchPasta:", e);
    if (!res.headersSent) res.status(500).json({ error: msg });
  }
});

/**
 * Lista mídias da empresa (opcionalmente por pasta).
 */
r.get("/:idEmpresa/midias", async (req, res) => {
  try {
    const idEmpresa = z.string().uuid().safeParse(req.params.idEmpresa);
    if (!idEmpresa.success) {
      res.status(400).json({ error: "id_empresa inválido" });
      return;
    }
    const q = z
      .object({
        id_pasta: z.string().uuid().optional(),
      })
      .safeParse(req.query);
    if (!q.success) {
      res.status(400).json({ error: q.error.flatten() });
      return;
    }
    const supabase = db();
    if (!supabase) {
      res.status(503).json({ error: "Supabase não configurado" });
      return;
    }
    const { data: membro, error: ePerm } = await getMembroAtivoEmpresa(
      supabase,
      idEmpresa.data,
      req.usuario.id_usuario,
    );
    if (ePerm) {
      res.status(500).json({ error: ePerm.message });
      return;
    }
    if (!membro) {
      res.status(403).json({ error: "Sem permissão para acessar mídias desta empresa" });
      return;
    }

    let query = supabase
      .from("midias")
      .select("*")
      .eq("id_empresa", idEmpresa.data)
      .eq("ativo", true)
      .order("data_criacao", { ascending: false });
    if (q.data.id_pasta) query = query.eq("id_pasta", q.data.id_pasta);
    const { data: midias, error: eList } = await query;
    if (eList) {
      res.status(500).json({ error: eList.message });
      return;
    }
    res.json({ midias: midias || [] });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    console.error("empresas.listMidias:", e);
    if (!res.headersSent) res.status(500).json({ error: msg });
  }
});

/**
 * Upload de mídia em base64 para Supabase Storage e registro no banco (admin/editor).
 */
r.post("/:idEmpresa/midias/upload-base64", async (req, res) => {
  try {
    const idEmpresa = z.string().uuid().safeParse(req.params.idEmpresa);
    if (!idEmpresa.success) {
      res.status(400).json({ error: "id_empresa inválido" });
      return;
    }
    const parsed = uploadMidiaBody.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const supabase = db();
    if (!supabase) {
      res.status(503).json({ error: "Supabase não configurado" });
      return;
    }
    const { data: membro, error: ePerm } = await getMembroAtivoEmpresa(
      supabase,
      idEmpresa.data,
      req.usuario.id_usuario,
    );
    if (ePerm) {
      res.status(500).json({ error: ePerm.message });
      return;
    }
    if (!membro || !podeGerenciarMidias(membro.cargo)) {
      res.status(403).json({ error: "Sem permissão para enviar mídia" });
      return;
    }

    const b = parsed.data;
    let idPastaDestino = b.id_pasta ?? null;
    if (!idPastaDestino) {
      try {
        idPastaDestino = await getOrCreatePastaUploadRaiz(supabase, idEmpresa.data);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Erro ao resolver pasta de destino";
        res.status(500).json({ error: msg });
        return;
      }
    }

    const buffer = Buffer.from(b.base64_data, "base64");
    if (!buffer.length) {
      res.status(400).json({ error: "base64_data inválido" });
      return;
    }
    const ext = safeExt(b.nome_arquivo);
    const stamp = Date.now();
    const slug = b.nome_arquivo.replace(/[^a-zA-Z0-9._-]/g, "_");
    const caminhoStorage = `${idEmpresa.data}/${idPastaDestino}/${stamp}_${slug}`;

    const { error: eUpload } = await supabase.storage
      .from(MEDIA_BUCKET)
      .upload(caminhoStorage, buffer, {
        contentType: b.mime_type,
        upsert: false,
      });
    if (eUpload) {
      res.status(500).json({ error: `Falha no upload storage: ${eUpload.message}` });
      return;
    }

    const publicUrl = supabase.storage
      .from(MEDIA_BUCKET)
      .getPublicUrl(caminhoStorage)?.data?.publicUrl;

    const row = {
      id_empresa: idEmpresa.data,
      id_pasta: idPastaDestino,
      criado_por_usuario_id: req.usuario.id_usuario,
      nome_arquivo: b.nome_arquivo,
      nome_exibicao: b.nome_exibicao?.trim() || b.nome_arquivo,
      tipo_midia: b.tipo_midia,
      formato_arquivo: b.mime_type,
      url_arquivo: publicUrl || null,
      caminho_storage: caminhoStorage,
      extensao: ext,
      tamanho_bytes: buffer.length,
      largura: null,
      altura: null,
      duracao_segundos: null,
      origem_upload: "upload_manual",
      descricao: b.descricao ?? null,
      alt_text: b.alt_text ?? null,
      ativo: true,
    };

    const { data: created, error: eInsert } = await supabase
      .from("midias")
      .insert(row)
      .select("*")
      .single();
    if (eInsert) {
      await supabase.storage.from(MEDIA_BUCKET).remove([caminhoStorage]);
      res.status(500).json({ error: eInsert.message });
      return;
    }

    res.status(201).json({ midia: created });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    console.error("empresas.uploadMidiaBase64:", e);
    if (!res.headersSent) res.status(500).json({ error: msg });
  }
});

/**
 * Remove mídia (soft delete no banco + remoção no storage), admin/editor.
 */
r.delete("/:idEmpresa/midias/:idMidia", async (req, res) => {
  try {
    const p = midiaParam.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ error: p.error.flatten() });
      return;
    }
    const supabase = db();
    if (!supabase) {
      res.status(503).json({ error: "Supabase não configurado" });
      return;
    }
    const { data: membro, error: ePerm } = await getMembroAtivoEmpresa(
      supabase,
      p.data.idEmpresa,
      req.usuario.id_usuario,
    );
    if (ePerm) {
      res.status(500).json({ error: ePerm.message });
      return;
    }
    if (!membro || !podeGerenciarMidias(membro.cargo)) {
      res.status(403).json({ error: "Sem permissão para remover mídia" });
      return;
    }

    const { data: midia, error: eFind } = await supabase
      .from("midias")
      .select("id_midia, caminho_storage")
      .eq("id_midia", p.data.idMidia)
      .eq("id_empresa", p.data.idEmpresa)
      .eq("ativo", true)
      .maybeSingle();
    if (eFind) {
      res.status(500).json({ error: eFind.message });
      return;
    }
    if (!midia) {
      res.status(404).json({ error: "Mídia não encontrada" });
      return;
    }

    const { error: eSoft } = await supabase
      .from("midias")
      .update({ ativo: false })
      .eq("id_midia", p.data.idMidia)
      .eq("id_empresa", p.data.idEmpresa);
    if (eSoft) {
      res.status(500).json({ error: eSoft.message });
      return;
    }

    if (midia.caminho_storage) {
      await supabase.storage.from(MEDIA_BUCKET).remove([midia.caminho_storage]);
    }
    res.json({ removido: true, id_midia: p.data.idMidia });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    console.error("empresas.deleteMidia:", e);
    if (!res.headersSent) res.status(500).json({ error: msg });
  }
});

/**
 * Atualiza mídia: mover de pasta, renomear exibição, ou ambos. Admin/editor.
 */
r.patch("/:idEmpresa/midias/:idMidia", async (req, res) => {
  try {
    const p = midiaParam.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ error: p.error.flatten() });
      return;
    }
    const parsed = patchMidiaBody.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const supabase = db();
    if (!supabase) {
      res.status(503).json({ error: "Supabase não configurado" });
      return;
    }
    const { data: membro, error: ePerm } = await getMembroAtivoEmpresa(
      supabase,
      p.data.idEmpresa,
      req.usuario.id_usuario,
    );
    if (ePerm) {
      res.status(500).json({ error: ePerm.message });
      return;
    }
    if (!membro || !podeGerenciarMidias(membro.cargo)) {
      res.status(403).json({ error: "Sem permissão para alterar mídia" });
      return;
    }

    const wantPasta = parsed.data.id_pasta;
    const wantNomeRaw = parsed.data.nome_exibicao;

    const { data: midia, error: eFind } = await supabase
      .from("midias")
      .select("*")
      .eq("id_midia", p.data.idMidia)
      .eq("id_empresa", p.data.idEmpresa)
      .eq("ativo", true)
      .maybeSingle();
    if (eFind) {
      res.status(500).json({ error: eFind.message });
      return;
    }
    if (!midia?.caminho_storage) {
      res.status(404).json({ error: "Mídia não encontrada" });
      return;
    }

    const nomeExFinal =
      wantNomeRaw !== undefined ? wantNomeRaw.trim() : midia.nome_exibicao;
    const mudouNome = wantNomeRaw !== undefined && nomeExFinal !== midia.nome_exibicao;
    const mudouPasta =
      wantPasta !== undefined && wantPasta !== midia.id_pasta;

    if (!mudouPasta && !mudouNome) {
      res.json({ midia });
      return;
    }

    if (!mudouPasta && mudouNome) {
      const { data: atualizada, error: eUp } = await supabase
        .from("midias")
        .update({
          nome_exibicao: nomeExFinal,
          data_atualizacao: new Date().toISOString(),
        })
        .eq("id_midia", p.data.idMidia)
        .eq("id_empresa", p.data.idEmpresa)
        .select("*")
        .single();
      if (eUp) {
        res.status(500).json({ error: eUp.message });
        return;
      }
      res.json({ midia: atualizada });
      return;
    }

    const novaPasta = wantPasta;
    const { data: pastaDest, error: ePasta } = await supabase
      .from("pastas")
      .select("id_pasta")
      .eq("id_pasta", novaPasta)
      .eq("id_empresa", p.data.idEmpresa)
      .eq("ativo", true)
      .maybeSingle();
    if (ePasta) {
      res.status(500).json({ error: ePasta.message });
      return;
    }
    if (!pastaDest) {
      res.status(400).json({ error: "Pasta de destino inválida" });
      return;
    }

    const baseName = path.basename(midia.caminho_storage);
    const novoCaminho = `${p.data.idEmpresa}/${novaPasta}/${baseName}`;

    const { error: eMove } = await supabase.storage
      .from(MEDIA_BUCKET)
      .move(midia.caminho_storage, novoCaminho);
    if (eMove) {
      res.status(500).json({ error: `Falha ao mover no storage: ${eMove.message}` });
      return;
    }

    const publicUrl = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(novoCaminho)?.data?.publicUrl;

    const { data: atualizada, error: eUp } = await supabase
      .from("midias")
      .update({
        id_pasta: novaPasta,
        caminho_storage: novoCaminho,
        url_arquivo: publicUrl || null,
        nome_exibicao: nomeExFinal,
        data_atualizacao: new Date().toISOString(),
      })
      .eq("id_midia", p.data.idMidia)
      .eq("id_empresa", p.data.idEmpresa)
      .select("*")
      .single();
    if (eUp) {
      await supabase.storage.from(MEDIA_BUCKET).move(novoCaminho, midia.caminho_storage);
      res.status(500).json({ error: eUp.message });
      return;
    }
    res.json({ midia: atualizada });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    console.error("empresas.patchMidia:", e);
    if (!res.headersSent) res.status(500).json({ error: msg });
  }
});

/**
 * Remove pasta vazia (soft delete), admin/editor.
 */
r.delete("/:idEmpresa/pastas/:idPasta", async (req, res) => {
  try {
    const p = pastaParam.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ error: p.error.flatten() });
      return;
    }
    const supabase = db();
    if (!supabase) {
      res.status(503).json({ error: "Supabase não configurado" });
      return;
    }
    const { data: membro, error: ePerm } = await getMembroAtivoEmpresa(
      supabase,
      p.data.idEmpresa,
      req.usuario.id_usuario,
    );
    if (ePerm) {
      res.status(500).json({ error: ePerm.message });
      return;
    }
    if (!membro || !podeGerenciarMidias(membro.cargo)) {
      res.status(403).json({ error: "Sem permissão para remover pasta" });
      return;
    }

    const { count: hasFilhos, error: eFilhos } = await supabase
      .from("pastas")
      .select("id_pasta", { count: "exact", head: true })
      .eq("id_empresa", p.data.idEmpresa)
      .eq("id_pasta_pai", p.data.idPasta)
      .eq("ativo", true);
    if (eFilhos) {
      res.status(500).json({ error: eFilhos.message });
      return;
    }

    const { count: hasMidias, error: eMidias } = await supabase
      .from("midias")
      .select("id_midia", { count: "exact", head: true })
      .eq("id_empresa", p.data.idEmpresa)
      .eq("id_pasta", p.data.idPasta)
      .eq("ativo", true);
    if (eMidias) {
      res.status(500).json({ error: eMidias.message });
      return;
    }

    if ((hasFilhos || 0) > 0 || (hasMidias || 0) > 0) {
      res.status(409).json({ error: "A pasta não está vazia" });
      return;
    }

    const { error: eDelete } = await supabase
      .from("pastas")
      .update({ ativo: false })
      .eq("id_pasta", p.data.idPasta)
      .eq("id_empresa", p.data.idEmpresa)
      .eq("ativo", true);
    if (eDelete) {
      res.status(500).json({ error: eDelete.message });
      return;
    }
    res.json({ removida: true, id_pasta: p.data.idPasta });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    console.error("empresas.deletePasta:", e);
    if (!res.headersSent) res.status(500).json({ error: msg });
  }
});

/**
 * Altera cargo de membro da empresa (apenas administrador).
 */
r.patch("/:idEmpresa/membros/:idUsuario", async (req, res) => {
  try {
    const p = membroParam.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ error: p.error.flatten() });
      return;
    }
    const b = patchMembroBody.safeParse(req.body ?? {});
    if (!b.success) {
      res.status(400).json({ error: b.error.flatten() });
      return;
    }

    const supabase = db();
    if (!supabase) {
      res.status(503).json({ error: "Supabase não configurado" });
      return;
    }

    const { data: admin, error: ePerm } = await supabase
      .from("usuarios_empresa")
      .select("cargo")
      .eq("id_empresa", p.data.idEmpresa)
      .eq("id_usuario", req.usuario.id_usuario)
      .eq("ativo", true)
      .maybeSingle();

    if (ePerm) {
      res.status(500).json({ error: ePerm.message });
      return;
    }
    if (!admin || admin.cargo !== "administrador") {
      res.status(403).json({ error: "Sem permissão para gerenciar membros" });
      return;
    }

    const { data: updated, error: eUp } = await supabase
      .from("usuarios_empresa")
      .update({
        cargo: b.data.cargo,
        perfil_acesso: perfilAcessoPorCargo(b.data.cargo),
      })
      .eq("id_empresa", p.data.idEmpresa)
      .eq("id_usuario", p.data.idUsuario)
      .eq("ativo", true)
      .select("id_usuario, cargo, perfil_acesso, ativo")
      .maybeSingle();

    if (eUp) {
      res.status(500).json({ error: eUp.message });
      return;
    }
    if (!updated) {
      res.status(404).json({ error: "Membro não encontrado" });
      return;
    }

    res.json({ membro: updated });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    console.error("empresas.patchMembro:", e);
    if (!res.headersSent) res.status(500).json({ error: msg });
  }
});

/**
 * Remove membro da empresa (soft delete com ativo=false), apenas administrador.
 */
r.delete("/:idEmpresa/membros/:idUsuario", async (req, res) => {
  try {
    const p = membroParam.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ error: p.error.flatten() });
      return;
    }

    if (p.data.idUsuario === req.usuario.id_usuario) {
      res.status(400).json({ error: "Você não pode remover a si mesmo" });
      return;
    }

    const supabase = db();
    if (!supabase) {
      res.status(503).json({ error: "Supabase não configurado" });
      return;
    }

    const { data: admin, error: ePerm } = await supabase
      .from("usuarios_empresa")
      .select("cargo")
      .eq("id_empresa", p.data.idEmpresa)
      .eq("id_usuario", req.usuario.id_usuario)
      .eq("ativo", true)
      .maybeSingle();

    if (ePerm) {
      res.status(500).json({ error: ePerm.message });
      return;
    }
    if (!admin || admin.cargo !== "administrador") {
      res.status(403).json({ error: "Sem permissão para gerenciar membros" });
      return;
    }

    const { data: updated, error: eUp } = await supabase
      .from("usuarios_empresa")
      .update({ ativo: false })
      .eq("id_empresa", p.data.idEmpresa)
      .eq("id_usuario", p.data.idUsuario)
      .eq("ativo", true)
      .select("id_usuario, ativo")
      .maybeSingle();

    if (eUp) {
      res.status(500).json({ error: eUp.message });
      return;
    }
    if (!updated) {
      res.status(404).json({ error: "Membro não encontrado" });
      return;
    }

    res.json({ removido: true, id_usuario: updated.id_usuario });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    console.error("empresas.deleteMembro:", e);
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

    const { error: eMem } = await supabase.from("usuarios_empresa").insert({
      id_empresa: emp.id_empresa,
      id_usuario: req.usuario.id_usuario,
      cargo: "administrador",
      perfil_acesso: "administrador",
      responsavel_operacional: true,
      receber_alertas: true,
      ativo: true,
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
      .from("usuarios_empresa")
      .select("cargo, ativo")
      .eq("id_empresa", idEmpresa.data)
      .eq("id_usuario", req.usuario.id_usuario)
      .eq("ativo", true)
      .maybeSingle();

    if (eM) {
      res.status(500).json({ error: eM.message });
      return;
    }

    if (!membro || membro.cargo !== "administrador") {
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
          : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      const insertRow = {
        id_empresa: idEmpresa.data,
        codigo,
        id_usuario_criador: req.usuario.id_usuario,
        data_expiracao: expira,
        email_destino: parsed.data.email_destino ?? null,
        cargo: parsed.data.cargo ?? "membro",
        perfil_acesso: parsed.data.perfil_acesso ?? "editor",
        responsavel_operacional: parsed.data.responsavel_operacional ?? false,
        receber_alertas: parsed.data.receber_alertas ?? true,
        max_usos: 1,
        usos: 0,
        ativo: true,
      };

      const { data: conv, error: eC } = await supabase
        .from("empresa_convites")
        .insert(insertRow)
        .select("id_convite, codigo, data_expiracao, max_usos, data_criacao")
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
