import { z } from "zod";
import {
  createConviteBody,
  gerarCodigoConvite,
  normalizarCodigo,
  resgatarBody,
  cargoApiDeUsuarioEmpresa,
} from "./shared.js";

/**
 * Resgata convite por código (POST /empresas/convites/resgatar).
 * @param {string} idUsuario - `req.usuario.id_usuario`
 */
export async function executarResgateConvite(supabase, idUsuario, rawBody) {
  const parsed = resgatarBody.safeParse(rawBody);
  if (!parsed.success) {
    return { ok: false, status: 400, error: parsed.error.flatten() };
  }

  const codigo = normalizarCodigo(parsed.data.codigo);
  if (codigo.length < 4) {
    return { ok: false, status: 400, error: "Código inválido" };
  }

  const { data: conv, error: eC } = await supabase
    .from("empresa_convite")
    .select("*")
    .eq("codigo", codigo)
    .eq("ativo", true)
    .maybeSingle();

  if (eC) {
    return { ok: false, status: 500, error: eC.message };
  }

  if (!conv) {
    return { ok: false, status: 404, error: "Convite não encontrado ou inativo" };
  }

  if (conv.data_expiracao && new Date(conv.data_expiracao) < new Date()) {
    return { ok: false, status: 410, error: "Este convite expirou" };
  }

  if (conv.usos >= conv.max_usos) {
    return { ok: false, status: 410, error: "Este convite já foi totalmente utilizado" };
  }

  const { data: empRow, error: eEmp } = await supabase
    .from("empresa")
    .select("*")
    .eq("id_empresa", conv.id_empresa)
    .maybeSingle();
  if (eEmp || !empRow) {
    return { ok: false, status: 500, error: "Empresa do convite não encontrada" };
  }
  const empresa = empRow;

  const { data: jaMembro } = await supabase
    .from("usuario_empresa")
    .select("id, cargo, perfil_acesso, responsavel_operacional, receber_alertas, ativo")
    .eq("id_empresa", conv.id_empresa)
    .eq("id_usuario", idUsuario)
    .maybeSingle();

  if (jaMembro?.ativo) {
    return {
      ok: true,
      status: 200,
      body: {
        ja_membro: true,
        empresa,
        papel: jaMembro.cargo,
        mensagem: "Você já faz parte desta empresa.",
      },
    };
  }

  const membroPayload = {
    id_empresa: conv.id_empresa,
    id_usuario: idUsuario,
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
      return { ok: false, status: 500, error: eUpM.message };
    }
  } else {
    const { error: eIns } = await supabase.from("usuario_empresa").insert(membroPayload);
    if (eIns) {
      return { ok: false, status: 500, error: eIns.message };
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
      .eq("id_usuario", idUsuario);
    return {
      ok: false,
      status: 500,
      error: "Conflito ao registrar o convite. Tente de novo.",
    };
  }

  return {
    ok: true,
    status: 201,
    body: {
      empresa,
      papel: membroPayload.cargo,
      mensagem: `Você entrou em ${empresa.nome_fantasia || "empresa"}.`,
    },
  };
}

/**
 * Cria convite (POST /empresas/:idEmpresa/convites). `gerarCodigo` e `now` permitem testes determinísticos.
 */
export async function executarCriacaoConviteAdmin(
  supabase,
  idEmpresa,
  idCriador,
  rawBody,
  options = {},
) {
  const idParsed = z.string().uuid().safeParse(idEmpresa);
  if (!idParsed.success) {
    return { ok: false, status: 400, error: "id_empresa inválido" };
  }

  const parsed = createConviteBody.safeParse(rawBody ?? {});
  if (!parsed.success) {
    return { ok: false, status: 400, error: parsed.error.flatten() };
  }

  const { data: membro, error: eM } = await supabase
    .from("usuario_empresa")
    .select("cargo, ativo")
    .eq("id_empresa", idParsed.data)
    .eq("id_usuario", idCriador)
    .eq("ativo", true)
    .maybeSingle();

  if (eM) {
    return { ok: false, status: 500, error: eM.message };
  }

  const papelCriador = cargoApiDeUsuarioEmpresa(membro);
  if (!membro || papelCriador !== "administrador") {
    return { ok: false, status: 403, error: "Sem permissão para criar convites nesta empresa" };
  }

  const now = options.now instanceof Date ? options.now : new Date();
  const gerarCodigo = typeof options.gerarCodigo === "function" ? options.gerarCodigo : gerarCodigoConvite;

  let codigo = gerarCodigo();
  for (let tentativa = 0; tentativa < 5; tentativa++) {
    const expira =
      parsed.data.expira_em_dias != null
        ? new Date(now.getTime() + parsed.data.expira_em_dias * 24 * 60 * 60 * 1000).toISOString()
        : new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const insertRow = {
      id_empresa: idParsed.data,
      codigo,
      id_usuario_criador: idCriador,
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
      return {
        ok: true,
        status: 201,
        body: {
          convite: conv,
          mensagem:
            "Guarde o código com segurança. Ele não será exibido novamente nesta forma.",
        },
      };
    }

    if (eC && !String(eC.message || "").includes("duplicate")) {
      return { ok: false, status: 500, error: eC.message };
    }
    codigo = gerarCodigo();
  }

  return { ok: false, status: 500, error: "Não foi possível gerar um código único" };
}
