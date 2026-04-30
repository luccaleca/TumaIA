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
const contextoParam = z.object({
  idEmpresa: z.string().uuid(),
  idContexto: z.string().uuid(),
});
const contextoTipoSchema = z.enum(["promocao", "lancamento", "data_comemorativa", "personalizado"]);

function parseJsonIfString(v) {
  if (typeof v !== "string") return v;
  const txt = v.trim();
  if (!txt) return {};
  try {
    return JSON.parse(txt);
  } catch {
    return v;
  }
}

function textoNormalizado(v, maxLen) {
  if (v == null) return null;
  const txt = String(v).replace(/\r\n/g, "\n").trim();
  if (!txt) return null;
  return txt.slice(0, maxLen);
}

function sanitizeJsonValue(value, depth = 0) {
  if (depth > 8) return null;
  if (value == null) return null;
  if (typeof value === "string") return value.replace(/\r\n/g, "\n").trim();
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) {
    return value
      .map((item) => sanitizeJsonValue(item, depth + 1))
      .filter((item) => item !== undefined);
  }
  if (typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (!k) continue;
      const clean = sanitizeJsonValue(v, depth + 1);
      if (clean !== undefined) out[k] = clean;
    }
    return out;
  }
  return undefined;
}

function normalizeContextoPayload(input) {
  const tipo = contextoTipoSchema.parse(input?.tipo);
  const nome = textoNormalizado(input?.nome, 200);
  const descricao = textoNormalizado(input?.descricao, 2000) ?? "";
  const dadosBase = parseJsonIfString(input?.dados);
  const dados = sanitizeJsonValue(dadosBase);
  const dadosObj =
    dados && typeof dados === "object" && !Array.isArray(dados) ? dados : { conteudo: dados };
  return {
    tipo,
    nome,
    descricao,
    dados: dadosObj,
  };
}

const contextoBody = z.object({
  tipo: contextoTipoSchema,
  nome: z.string().max(200).optional().nullable(),
  descricao: z.string().max(2000).optional().nullable(),
  dados: z.preprocess(parseJsonIfString, z.record(z.unknown())),
});

function perfilAcessoPorCargo(cargo) {
  if (cargo === "administrador") return "administrador";
  return "editor";
}

const MEDIA_BUCKET = env.MEDIA_BUCKET || "midias";

async function vincularCriadorComoMembro(supabase, idEmpresa, idUsuario) {
  const payloadLegacy = {
    id_empresa: idEmpresa,
    id_usuario: idUsuario,
    cargo: "administrador",
    perfil_acesso: "administrador",
    responsavel_operacional: true,
    receber_alertas: true,
    ativo: true,
  };

  const legacyInsert = await supabase.from("usuario_empresa").insert(payloadLegacy);
  if (!legacyInsert.error) return { ok: true };

  const msg = String(legacyInsert.error.message || "");
  const schemaLegacyInvalido =
    /column|schema|does not exist|not found|papel|cargo|perfil_acesso/i.test(msg);
  if (!schemaLegacyInvalido) {
    return { ok: false, error: legacyInsert.error };
  }

  const payloadNovo = {
    id_empresa: idEmpresa,
    id_usuario: idUsuario,
    papel: "admin",
  };
  const novoInsert = await supabase.from("usuario_empresa").insert(payloadNovo);
  if (!novoInsert.error) return { ok: true };
  return { ok: false, error: novoInsert.error };
}

async function getMembroAtivoEmpresa(supabase, idEmpresa, idUsuario) {
  const { data, error } = await supabase
    .from("usuario_empresa")
    .select("id_usuario, cargo, ativo")
    .eq("id_empresa", idEmpresa)
    .eq("id_usuario", idUsuario)
    .eq("ativo", true)
    .maybeSingle();
  if (!data) return { data, error };
  const roleRaw = typeof data.cargo === "string" && data.cargo.trim() ? data.cargo : null;
  const role = String(roleRaw || "").trim().toLowerCase();
  const cargoNormalizado =
    role === "admin" || role === "administrador"
      ? "administrador"
      : role === "editor"
        ? "editor"
        : role === "membro" || role === "member"
          ? "membro"
          : null;
  return {
    data: {
      ...data,
      cargo: cargoNormalizado,
    },
    error,
  };
}

function podeGerenciarMidias(cargo) {
  return cargo === "administrador" || cargo === "editor";
}

function slugify(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function nomesTipoAceitos(tipo) {
  if (tipo === "promocao") return ["promocao", "promoção"];
  if (tipo === "lancamento") return ["lancamento", "lançamento"];
  if (tipo === "data_comemorativa") return ["data comemorativa", "data_comemorativa"];
  if (tipo === "personalizado") return ["personalizado"];
  return [tipo];
}

function nomeTipoPadrao(tipo) {
  if (tipo === "promocao") return "Promoção";
  if (tipo === "lancamento") return "Lançamento";
  if (tipo === "data_comemorativa") return "Data Comemorativa";
  if (tipo === "personalizado") return "Personalizado";
  return String(tipo || "Personalizado");
}

async function resolverTipoETemplate(supabase, tipo) {
  const { data: tipos, error: eTipos } = await supabase
    .from("tipo_contexto")
    .select("id_tipo_contexto, nome")
    .eq("ativo", true);
  if (eTipos) throw new Error(eTipos.message);
  const wanted = new Set(nomesTipoAceitos(tipo).map(slugify));
  let tipoRow = (tipos || []).find((t) => wanted.has(slugify(t.nome)));
  if (!tipoRow) {
    const nomePadrao = nomeTipoPadrao(tipo);
    const { data: createdTipo, error: eInsTipo } = await supabase
      .from("tipo_contexto")
      .insert({
        nome: nomePadrao,
        descricao: `Tipo de contexto: ${nomePadrao}`,
        ativo: true,
      })
      .select("id_tipo_contexto, nome")
      .single();
    if (eInsTipo) {
      const { data: retryTipos, error: eRetryTipos } = await supabase
        .from("tipo_contexto")
        .select("id_tipo_contexto, nome")
        .eq("ativo", true);
      if (eRetryTipos) throw new Error(eRetryTipos.message);
      tipoRow = (retryTipos || []).find((t) => wanted.has(slugify(t.nome)));
      if (!tipoRow) throw new Error(eInsTipo.message);
    } else {
      tipoRow = createdTipo;
    }
  }

  const { data: templates, error: eTpl } = await supabase
    .from("template_contexto")
    .select("id_template")
    .eq("id_tipo_contexto", tipoRow.id_tipo_contexto)
    .eq("ativo", true)
    .limit(1);
  if (eTpl) throw new Error(eTpl.message);
  let idTemplate = templates?.[0]?.id_template;
  if (!idTemplate) {
    const nomePadrao = nomeTipoPadrao(tipo);
    const { data: createdTpl, error: eInsTpl } = await supabase
      .from("template_contexto")
      .insert({
        id_tipo_contexto: tipoRow.id_tipo_contexto,
        nome: "Template padrão",
        descricao: `Template padrão para ${nomePadrao}`,
        schema_json: {
          tipo,
          versao: 1,
        },
        ui_schema_json: {
          layout: "auto",
          tipo,
        },
        prompt_base: `Use o contexto do tipo "${nomePadrao}" para gerar texto de marketing.`,
        ativo: true,
      })
      .select("id_template")
      .single();
    if (eInsTpl) {
      const { data: retryTpl, error: eRetryTpl } = await supabase
        .from("template_contexto")
        .select("id_template")
        .eq("id_tipo_contexto", tipoRow.id_tipo_contexto)
        .eq("ativo", true)
        .limit(1);
      if (eRetryTpl) throw new Error(eRetryTpl.message);
      idTemplate = retryTpl?.[0]?.id_template;
      if (!idTemplate) throw new Error(eInsTpl.message);
    } else {
      idTemplate = createdTpl.id_template;
    }
  }
  return {
    idTipoContexto: tipoRow.id_tipo_contexto,
    nomeTipoContexto: tipoRow.nome,
    idTemplate,
  };
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
    .from("pasta")
    .select("id_pasta")
    .eq("id_empresa", idEmpresa)
    .is("id_pasta_pai", null)
    .eq("nome", PASTA_UPLOAD_RAIZ_NOME)
    .eq("ativo", true)
    .maybeSingle();
  if (eFind) throw new Error(eFind.message);
  if (found?.id_pasta) return found.id_pasta;

  const { data: created, error: eIns } = await supabase
    .from("pasta")
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
        .from("pasta")
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
      .from("empresa_convite")
      .select("*")
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

    const { data: empRow, error: eEmp } = await supabase
      .from("empresa")
      .select("*")
      .eq("id_empresa", conv.id_empresa)
      .maybeSingle();
    if (eEmp || !empRow) {
      res.status(500).json({ error: "Empresa do convite não encontrada" });
      return;
    }
    const empresa = empRow;

    const { data: jaMembro } = await supabase
      .from("usuario_empresa")
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
        .from("usuario_empresa")
        .update(membroPayload)
        .eq("id", jaMembro.id);
      if (eUpM) {
        res.status(500).json({ error: eUpM.message });
        return;
      }
    } else {
      const { error: eIns } = await supabase
        .from("usuario_empresa")
        .insert(membroPayload);
      if (eIns) {
        res.status(500).json({ error: eIns.message });
        return;
      }
    }

    const novosUsos = conv.usos + 1;
    const esgotou = novosUsos >= conv.max_usos;

    const { data: updated, error: eUp } = await supabase
      .from("empresa_convite")
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
        .from("usuario_empresa")
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
      .from("usuario_empresa")
      .select("cargo, perfil_acesso, responsavel_operacional, receber_alertas, id_empresa")
      .eq("id_usuario", req.usuario.id_usuario)
      .eq("ativo", true);

    if (e1) {
      res.status(500).json({ error: e1.message });
      return;
    }

    const empresaIds = [...new Set((membros || []).map((m) => m.id_empresa).filter(Boolean))];
    const empresasMap = new Map();
    if (empresaIds.length) {
      const { data: empresasRows, error: eEmps } = await supabase
        .from("empresa")
        .select("*")
        .in("id_empresa", empresaIds);
      if (eEmps) {
        res.status(500).json({ error: eEmps.message });
        return;
      }
      for (const emp of empresasRows || []) {
        empresasMap.set(emp.id_empresa, emp);
      }
    }

    const lista = (membros || []).map((m) => ({
      papel: m.cargo,
      perfil_acesso: m.perfil_acesso,
      responsavel_operacional: !!m.responsavel_operacional,
      receber_alertas: !!m.receber_alertas,
      empresa: empresasMap.get(m.id_empresa) || null,
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
      .from("empresa")
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
      .from("usuario_empresa")
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
      .from("usuario_empresa")
      .select("id_usuario, cargo, perfil_acesso, responsavel_operacional, receber_alertas, ativo")
      .eq("id_empresa", idEmpresa.data)
      .eq("ativo", true);

    if (eList) {
      res.status(500).json({ error: eList.message });
      return;
    }

    const idsUsuarios = [...new Set((membros || []).map((m) => m.id_usuario).filter(Boolean))];
    const usuarioMap = new Map();
    if (idsUsuarios.length) {
      const { data: usuariosRows, error: eUsers } = await supabase
        .from("usuario")
        .select("id_usuario, nome, email")
        .in("id_usuario", idsUsuarios);
      if (eUsers) {
        res.status(500).json({ error: eUsers.message });
        return;
      }
      for (const u of usuariosRows || []) {
        usuarioMap.set(u.id_usuario, u);
      }
    }

    const lista = (membros || []).map((m) => {
      const u = usuarioMap.get(m.id_usuario);
      return {
        id_usuario: m.id_usuario,
        nome: u?.nome ?? null,
        email: u?.email ?? null,
        cargo: m.cargo,
        perfil_acesso: m.perfil_acesso,
        responsavel_operacional: !!m.responsavel_operacional,
        receber_alertas: !!m.receber_alertas,
        ativo: !!m.ativo,
      };
    });

    res.json({ membros: lista });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    console.error("empresas.membros:", e);
    if (!res.headersSent) res.status(500).json({ error: msg });
  }
});

/** Lista contextos ativos da empresa (qualquer membro ativo pode ver). */
r.get("/:idEmpresa/contextos", async (req, res) => {
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
      res.status(403).json({ error: "Sem permissão para acessar contextos desta empresa" });
      return;
    }
    const { data: rows, error: eList } = await supabase
      .from("contexto_empresa")
      .select("id_contexto_empresa, nome, descricao, schema_json, dados_json, data_criacao, data_atualizacao")
      .eq("id_empresa", idEmpresa.data)
      .eq("ativo", true)
      .order("data_criacao", { ascending: false });
    if (eList) {
      res.status(500).json({ error: eList.message });
      return;
    }
    res.json({ contextos: rows || [] });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    console.error("empresas.listContextos:", e);
    if (!res.headersSent) res.status(500).json({ error: msg });
  }
});

/** Cria contexto na empresa (admin/editor). */
r.post("/:idEmpresa/contextos", async (req, res) => {
  try {
    const idEmpresa = z.string().uuid().safeParse(req.params.idEmpresa);
    if (!idEmpresa.success) {
      res.status(400).json({ error: "id_empresa inválido" });
      return;
    }
    const body = contextoBody.safeParse(req.body ?? {});
    if (!body.success) {
      res.status(400).json({
        error: "Payload de contexto invalido",
        details: body.error.flatten(),
      });
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
      res.status(403).json({
        error: "Sem permissão para criar contexto",
        details: {
          cargo_detectado: membro?.cargo ?? null,
        },
      });
      return;
    }
    const payload = normalizeContextoPayload(body.data);
    const resolved = await resolverTipoETemplate(supabase, payload.tipo);
    const { data: created, error: eInsert } = await supabase
      .from("contexto_empresa")
      .insert({
        id_empresa: idEmpresa.data,
        id_tipo_contexto: resolved.idTipoContexto,
        id_template: resolved.idTemplate,
        criado_por_usuario_id: req.usuario.id_usuario,
        nome: payload.nome || `${resolved.nomeTipoContexto} ${new Date().toLocaleDateString("pt-BR")}`,
        descricao: payload.descricao,
        origem: "manual",
        schema_json: {
          tipo: payload.tipo,
          versao: 1,
        },
        dados_json: {
          tipo: payload.tipo,
          ...payload.dados,
        },
        ativo: true,
      })
      .select("id_contexto_empresa, nome, descricao, schema_json, dados_json, data_criacao, data_atualizacao")
      .single();
    if (eInsert) {
      res.status(500).json({ error: eInsert.message });
      return;
    }
    res.status(201).json({ contexto: created });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    console.error("empresas.createContexto:", e);
    if (!res.headersSent) res.status(500).json({ error: msg });
  }
});

/** Atualiza contexto da empresa (admin/editor). */
r.patch("/:idEmpresa/contextos/:idContexto", async (req, res) => {
  try {
    const p = contextoParam.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ error: p.error.flatten() });
      return;
    }
    const body = contextoBody.safeParse(req.body ?? {});
    if (!body.success) {
      res.status(400).json({
        error: "Payload de contexto invalido",
        details: body.error.flatten(),
      });
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
      res.status(403).json({
        error: "Sem permissão para editar contexto",
        details: {
          cargo_detectado: membro?.cargo ?? null,
        },
      });
      return;
    }
    const payload = normalizeContextoPayload(body.data);
    const resolved = await resolverTipoETemplate(supabase, payload.tipo);
    const { data: updated, error: eUp } = await supabase
      .from("contexto_empresa")
      .update({
        id_tipo_contexto: resolved.idTipoContexto,
        id_template: resolved.idTemplate,
        nome: payload.nome || `${resolved.nomeTipoContexto} ${new Date().toLocaleDateString("pt-BR")}`,
        descricao: payload.descricao,
        schema_json: {
          tipo: payload.tipo,
          versao: 1,
        },
        dados_json: {
          tipo: payload.tipo,
          ...payload.dados,
        },
      })
      .eq("id_contexto_empresa", p.data.idContexto)
      .eq("id_empresa", p.data.idEmpresa)
      .eq("ativo", true)
      .select("id_contexto_empresa, nome, descricao, schema_json, dados_json, data_criacao, data_atualizacao")
      .maybeSingle();
    if (eUp) {
      res.status(500).json({ error: eUp.message });
      return;
    }
    if (!updated) {
      res.status(404).json({ error: "Contexto não encontrado" });
      return;
    }
    res.json({ contexto: updated });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    console.error("empresas.patchContexto:", e);
    if (!res.headersSent) res.status(500).json({ error: msg });
  }
});

/** Remove contexto (soft delete, admin/editor). */
r.delete("/:idEmpresa/contextos/:idContexto", async (req, res) => {
  try {
    const p = contextoParam.safeParse(req.params);
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
      res.status(403).json({
        error: "Sem permissão para remover contexto",
        details: {
          cargo_detectado: membro?.cargo ?? null,
        },
      });
      return;
    }
    const { data: removed, error: eDel } = await supabase
      .from("contexto_empresa")
      .update({ ativo: false })
      .eq("id_contexto_empresa", p.data.idContexto)
      .eq("id_empresa", p.data.idEmpresa)
      .eq("ativo", true)
      .select("id_contexto_empresa")
      .maybeSingle();
    if (eDel) {
      res.status(500).json({ error: eDel.message });
      return;
    }
    if (!removed) {
      res.status(404).json({ error: "Contexto não encontrado" });
      return;
    }
    res.json({ removido: true, id_contexto_empresa: removed.id_contexto_empresa });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    console.error("empresas.deleteContexto:", e);
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
      .from("pasta")
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
      .from("pasta")
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
      .from("pasta")
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
        .from("pasta")
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
        .from("pasta")
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
        .from("pasta")
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
        .from("pasta")
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
      .from("pasta")
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
      .from("midia")
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
      .from("midia")
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
      .from("midia")
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
      .from("midia")
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
      .from("midia")
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
        .from("midia")
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
      .from("pasta")
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
      .from("midia")
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
      .from("pasta")
      .select("id_pasta", { count: "exact", head: true })
      .eq("id_empresa", p.data.idEmpresa)
      .eq("id_pasta_pai", p.data.idPasta)
      .eq("ativo", true);
    if (eFilhos) {
      res.status(500).json({ error: eFilhos.message });
      return;
    }

    const { count: hasMidias, error: eMidias } = await supabase
      .from("midia")
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
      .from("pasta")
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
      .from("usuario_empresa")
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
      .from("usuario_empresa")
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
      .from("usuario_empresa")
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
      .from("usuario_empresa")
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
      .from("empresa")
      .insert(row)
      .select("*")
      .single();

    if (eEmp) {
      res.status(500).json({ error: eEmp.message });
      return;
    }

    const memb = await vincularCriadorComoMembro(
      supabase,
      emp.id_empresa,
      req.usuario.id_usuario,
    );
    const eMem = memb.ok ? null : memb.error;

    if (eMem) {
      await supabase.from("empresa").delete().eq("id_empresa", emp.id_empresa);
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
      .from("usuario_empresa")
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
        .from("empresa_convite")
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
