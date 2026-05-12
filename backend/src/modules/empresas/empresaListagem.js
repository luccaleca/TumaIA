import { cargoApiDeUsuarioEmpresa } from "./shared.js";

/** Monta o JSON de `GET /empresas/minhas` a partir das linhas do banco. */
export function montarListaMinhasEmpresas(membros, empresasRows) {
  const empresasMap = new Map();
  for (const emp of empresasRows || []) {
    empresasMap.set(emp.id_empresa, emp);
  }
  const lista = (membros || []).map((m) => ({
    papel: cargoApiDeUsuarioEmpresa(m),
    perfil_acesso: m.perfil_acesso,
    responsavel_operacional: !!m.responsavel_operacional,
    receber_alertas: !!m.receber_alertas,
    empresa: empresasMap.get(m.id_empresa) || null,
  }));
  lista.sort((a, b) => {
    const na = (a.empresa?.nome_fantasia || "").toLocaleLowerCase("pt-BR");
    const nb = (b.empresa?.nome_fantasia || "").toLocaleLowerCase("pt-BR");
    const c = na.localeCompare(nb, "pt-BR");
    if (c !== 0) return c;
    return String(a.empresa?.id_empresa || "").localeCompare(String(b.empresa?.id_empresa || ""));
  });
  return lista;
}

/** Monta o JSON de `GET /empresas/:id/membros` (lista para a página). */
export function montarListaMembrosComUsuarios(membros, usuariosRows) {
  const usuarioMap = new Map();
  for (const u of usuariosRows || []) {
    usuarioMap.set(u.id_usuario, u);
  }
  return (membros || []).map((m) => {
    const u = usuarioMap.get(m.id_usuario);
    return {
      id_usuario: m.id_usuario,
      nome: u?.nome ?? null,
      email: u?.email ?? null,
      cargo: cargoApiDeUsuarioEmpresa(m),
      perfil_acesso: m.perfil_acesso,
      responsavel_operacional: !!m.responsavel_operacional,
      receber_alertas: !!m.receber_alertas,
      ativo: !!m.ativo,
    };
  });
}
