/**
 * Supabase mock mínimo para testes de fluxo de imagem (contexto_empresa, midia, empresa).
 *
 * @param {{
 *   contextoRows?: Array<Record<string, unknown>>,
 *   midiaRows?: Array<Record<string, unknown>>,
 *   empresaRow?: Record<string, unknown> | null,
 * }} fixtures
 */
export function createMockEmpresaDb(fixtures = {}) {
  const contextoRows = Array.isArray(fixtures.contextoRows) ? fixtures.contextoRows : [];
  const midiaRows = Array.isArray(fixtures.midiaRows) ? fixtures.midiaRows : [];
  const empresaRow = fixtures.empresaRow && typeof fixtures.empresaRow === "object" ? fixtures.empresaRow : null;

  function filterRows(table, chain) {
    let rows = table === "contexto_empresa" ? [...contextoRows] : table === "midia" ? [...midiaRows] : [];
    const f = chain._filters;
    if (f.id_empresa) rows = rows.filter((r) => String(r.id_empresa ?? f.id_empresa) === String(f.id_empresa));
    if (f.ativo !== undefined) rows = rows.filter((r) => r.ativo === f.ativo);
    if (f.id_midia_in?.length) {
      const set = new Set(f.id_midia_in.map(String));
      rows = rows.filter((r) => set.has(String(r.id_midia ?? "")));
    }
    if (chain._limit != null) rows = rows.slice(0, chain._limit);
    return rows;
  }

  function makeChain(table) {
    const chain = {
      _filters: {},
      _limit: null,
      _maybeSingle: false,
      select() {
        return chain;
      },
      eq(col, val) {
        chain._filters[col] = val;
        return chain;
      },
      in(col, vals) {
        chain._filters[`${col}_in`] = Array.isArray(vals) ? vals : [];
        return chain;
      },
      order() {
        return chain;
      },
      limit(n) {
        chain._limit = n;
        return chain;
      },
      maybeSingle() {
        chain._maybeSingle = true;
        return chain;
      },
      then(resolve, reject) {
        try {
          if (table === "empresa" && chain._maybeSingle) {
            resolve({ data: empresaRow, error: null });
            return;
          }
          const data = filterRows(table, chain);
          resolve({ data, error: null });
        } catch (err) {
          reject(err);
        }
      },
    };
    return chain;
  }

  return {
    from(table) {
      return makeChain(table);
    },
  };
}
