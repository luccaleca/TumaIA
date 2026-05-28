import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  narrowImageRowsByProductMention,
  parseProductMentionSpec,
} from "../../backend/src/services/productMentionMatch.js";
import { ACERVO_SUPLEMENTOS, GRUPOS } from "./fixtures/acervo-suplementos.fixture.js";

/** @typedef {"exact" | "includesAll" | "includesAny" | "subsetOf" | "excludes" | "empty"} ExpectKind */

/**
 * @typedef {{
 *   id: string,
 *   query: string,
 *   kind: ExpectKind,
 *   ids?: string[],
 *   min?: number,
 *   max?: number,
 *   forbidden?: string[],
 *   note?: string,
 * }} SearchCase
 */

function searchIds(query) {
  const spec = parseProductMentionSpec(query);
  const { pool, mode } = narrowImageRowsByProductMention(ACERVO_SUPLEMENTOS, query);
  return {
    spec,
    mode,
    ids: pool.map((r) => r.id).sort(),
  };
}

function evaluateCase(c) {
  const { ids, mode, spec } = searchIds(c.query);
  const forbidden = c.forbidden || [];
  const badForbidden = forbidden.filter((id) => ids.includes(id));

  if (badForbidden.length) {
    return { ok: false, ids, mode, spec, reason: `não deveria incluir: ${badForbidden.join(", ")}` };
  }

  switch (c.kind) {
    case "empty": {
      if (ids.length === 0) return { ok: true, ids, mode, spec };
      return { ok: false, ids, mode, spec, reason: `esperava vazio, veio: ${ids.join(", ")}` };
    }
    case "exact": {
      const want = [...(c.ids || [])].sort();
      if (ids.length === want.length && ids.every((id, i) => id === want[i])) {
        return { ok: true, ids, mode, spec };
      }
      return {
        ok: false,
        ids,
        mode,
        spec,
        reason: `esperava exatamente [${want.join(", ")}], veio [${ids.join(", ")}]`,
      };
    }
    case "includesAll": {
      const missing = (c.ids || []).filter((id) => !ids.includes(id));
      if (!missing.length) return { ok: true, ids, mode, spec };
      return {
        ok: false,
        ids,
        mode,
        spec,
        reason: `faltou: ${missing.join(", ")} (veio: ${ids.join(", ") || "—"})`,
      };
    }
    case "includesAny": {
      const hit = (c.ids || []).some((id) => ids.includes(id));
      if (hit) return { ok: true, ids, mode, spec };
      return {
        ok: false,
        ids,
        mode,
        spec,
        reason: `nenhum de [${(c.ids || []).join(", ")}] — veio: ${ids.join(", ") || "—"}`,
      };
    }
    case "subsetOf": {
      const allowed = new Set(c.ids || []);
      const extra = ids.filter((id) => !allowed.has(id));
      if (!extra.length) {
        if (c.min != null && ids.length < c.min) {
          return { ok: false, ids, mode, spec, reason: `mínimo ${c.min}, veio ${ids.length}` };
        }
        if (c.max != null && ids.length > c.max) {
          return { ok: false, ids, mode, spec, reason: `máximo ${c.max}, veio ${ids.length}` };
        }
        return { ok: true, ids, mode, spec };
      }
      return {
        ok: false,
        ids,
        mode,
        spec,
        reason: `extras não permitidos: ${extra.join(", ")}`,
      };
    }
    case "excludes": {
      if (!ids.length) return { ok: true, ids, mode, spec };
      return { ok: false, ids, mode, spec, reason: `deveria bloquear, veio: ${ids.join(", ")}` };
    }
    default:
      return { ok: false, ids, mode, spec, reason: `kind desconhecido: ${c.kind}` };
  }
}

/** @returns {SearchCase[]} */
function buildCases() {
  /** @type {SearchCase[]} */
  const cases = [];

  const add = (c) => cases.push(c);

  // —— Pedidos explícitos do usuário ——
  add({
    id: "user-todos-pro-force",
    query: "quero post de todos os pro force",
    kind: "includesAll",
    ids: GRUPOS.proForce,
  });
  add({
    id: "user-whey-cookie-baunilha",
    query: "quero post de whey de cookie e baunilha",
    kind: "exact",
    ids: ["whey-cookies", "whey-baunilha"],
  });
  add({
    id: "user-monster",
    query: "quero post de monster",
    kind: "exact",
    ids: GRUPOS.monster,
  });
  add({
    id: "user-tudo-cookie",
    query: "quero post de tudo de cookie, entao whey e pro force e barrinha de proteina naked",
    kind: "includesAll",
    ids: ["pf-cookies", "whey-cookies"],
    forbidden: GRUPOS.creatinas,
  });
  add({
    id: "user-bebidas-proteicas",
    query: "quero post para bebidas proteicas",
    kind: "includesAny",
    ids: GRUPOS.bebidas,
    note: "interpretação ampla — pelo menos uma bebida/shake",
  });

  // —— Pro Force (variações + grafias) ——
  for (const [q, expect] of [
    ["post pro force morango", ["pf-morango"]],
    ["promo pro force chocolate", ["pf-chocolate"]],
    ["pro force cookies destaque", ["pf-cookies"]],
    ["proforce cafe", ["pf-cafe"]],
    ["pro-force kit 4", ["pf-kit4"]],
    ["arte com todos proforce", GRUPOS.proForce],
    ["quero os pro force morango chocolate e cookies", ["pf-morango", "pf-chocolate", "pf-cookies"]],
    ["pro force conjunto 4 sabores", ["pf-kit4"]],
    ["PRO FORCE morango", ["pf-morango"]],
    ["post da pro force", GRUPOS.proForce],
  ]) {
    add({
      id: `pf-${cases.length}`,
      query: q,
      kind: expect.length === GRUPOS.proForce.length ? "includesAll" : "includesAll",
      ids: expect,
      forbidden: expect.length === 1 ? GRUPOS.monster : [],
    });
  }

  // —— Whey growth ——
  for (const [q, ids] of [
    ["whey growth baunilha promo", ["whey-baunilha"]],
    ["post whey chocolate", ["whey-chocolate"]],
    ["whey cookies 30% off", ["whey-cookies"]],
    ["whey de cookies e baunilha", ["whey-cookies", "whey-baunilha"]],
    ["growth whey baunilha", ["whey-baunilha"]],
    ["quero whey sabor chocolate", ["whey-chocolate"]],
  ]) {
    add({ id: `whey-${cases.length}`, query: q, kind: "includesAll", ids, forbidden: GRUPOS.proForce });
  }

  // —— Creatina específica vs genérica ——
  add({
    id: "creatina-integral-only",
    query: "promo creatina integral academias",
    kind: "exact",
    ids: ["creatina-integral"],
  });
  add({
    id: "creatina-generica",
    query: "post promocional de creatina",
    kind: "includesAll",
    ids: GRUPOS.creatinas,
  });
  add({
    id: "creatina-max-growth",
    query: "creatinas max e growth em promo",
    kind: "exact",
    ids: ["creatina-max", "creatina-growth"],
  });
  add({
    id: "creatina-integral-growth-pedido",
    query: "creatina integral e growth",
    kind: "exact",
    ids: ["creatina-integral", "creatina-growth"],
  });

  // —— Monster ——
  for (const q of [
    "monster energy promo",
    "post monster 473ml",
    "lata monster academias",
    "promoção monster",
  ]) {
    add({ id: `mon-${cases.length}`, query: q, kind: "exact", ids: GRUPOS.monster, forbidden: GRUPOS.proForce });
  }

  // —— Barras naked ——
  for (const [q, id] of [
    ["barra naked wafer dark chocolate", "barra-dark"],
    ["barrinha naked cinnamon", "barra-canela"],
    ["naked wafer chocolate branco", "barra-branco"],
    ["barra de proteina avela naked", "barra-avela"],
    ["barras de proteina naked wafer", GRUPOS.barras],
  ]) {
    add({
      id: `bar-${cases.length}`,
      query: q,
      kind: id === GRUPOS.barras ? "includesAll" : "includesAll",
      ids: Array.isArray(id) ? id : [id],
    });
  }

  // —— Sabor chocolate (multi-produto) ——
  add({
    id: "chocolate-tudo",
    query: "quero post de tudo de chocolate",
    kind: "includesAll",
    ids: GRUPOS.saborChocolate,
    forbidden: ["pf-morango", "whey-baunilha", "monster"],
  });
  add({
    id: "chocolate-pro-force-whey",
    query: "pro force chocolate e whey chocolate",
    kind: "exact",
    ids: ["pf-chocolate", "whey-chocolate"],
  });

  // —— Sabor cookies ——
  add({
    id: "cookies-combo",
    query: "cookies no post: pro force e whey",
    kind: "exact",
    ids: GRUPOS.saborCookies,
  });
  add({
    id: "cookies-proforce-only",
    query: "pro force cookies chamativo",
    kind: "exact",
    ids: ["pf-cookies"],
  });

  // —— Não confundir marcas ——
  add({
    id: "monster-not-proforce",
    query: "monster energy",
    kind: "exact",
    ids: GRUPOS.monster,
    forbidden: GRUPOS.proForce,
  });
  add({
    id: "proforce-not-monster",
    query: "pro force morango",
    kind: "exact",
    ids: ["pf-morango"],
    forbidden: GRUPOS.monster,
  });
  add({
    id: "whey-not-creatina",
    query: "whey baunilha",
    kind: "exact",
    ids: ["whey-baunilha"],
    forbidden: GRUPOS.creatinas,
  });

  // —— Grafias / typos ——
  for (const q of [
    "proforce morango promo",
    "pro-force chocolate",
    "pro  force cookies",
    "post proforce cafe",
  ]) {
    add({ id: `typo-${cases.length}`, query: q, kind: "includesAny", ids: GRUPOS.proForce });
  }

  // —— Pedidos vagos / sem produto ——
  add({ id: "vago-promo", query: "quero um post bem chamativo para instagram", kind: "empty" });
  add({ id: "vago-black-friday", query: "arte black friday feed quadrado", kind: "empty" });

  // —— Completar até ~100 com variações combinatórias ——
  const creatinaPedidos = [
    ["creatina max off", ["creatina-max"]],
    ["creatina growth desconto", ["creatina-growth"]],
    ["foco creatina integral", ["creatina-integral"]],
  ];
  for (const [q, ids] of creatinaPedidos) {
    add({ id: `cr-${cases.length}`, query: q, kind: "exact", ids });
  }

  const pfSabores = [
    ["morango", "pf-morango"],
    ["chocolate", "pf-chocolate"],
    ["cookies", "pf-cookies"],
    ["cafe", "pf-cafe"],
  ];
  for (const [sabor, id] of pfSabores) {
    add({
      id: `pf-sabor-${sabor}`,
      query: `destaque pro force ${sabor} 20% off`,
      kind: "exact",
      ids: [id],
      forbidden: GRUPOS.creatinas.concat(GRUPOS.monster),
    });
  }

  const wheySabores = [
    ["cookies", "whey-cookies"],
    ["chocolate", "whey-chocolate"],
    ["baunilha", "whey-baunilha"],
  ];
  for (const [sabor, id] of wheySabores) {
    add({
      id: `whey-sabor-${sabor}`,
      query: `post whey growth ${sabor}`,
      kind: "exact",
      ids: [id],
    });
  }

  const barraSabores = [
    ["dark chocolate", "barra-dark"],
    ["cinnamon", "barra-canela"],
    ["chocolate branco", "barra-branco"],
    ["avela", "barra-avela"],
  ];
  for (const [label, id] of barraSabores) {
    add({
      id: `barra-${id}`,
      query: `promo naked wafer ${label}`,
      kind: "exact",
      ids: [id],
    });
  }

  // Combinações 2 a 2 whey + pf
  const comboPairs = [
    ["whey cookies e pro force morango", ["whey-cookies", "pf-morango"]],
    ["pro force chocolate com whey baunilha", ["pf-chocolate", "whey-baunilha"]],
    ["monster e creatina integral", ["monster", "creatina-integral"]],
    ["creatina max com monster", ["creatina-max", "monster"]],
    ["barra avela e whey chocolate", ["barra-avela", "whey-chocolate"]],
  ];
  for (const [q, ids] of comboPairs) {
    add({ id: `pair-${cases.length}`, query: q, kind: "exact", ids });
  }

  // Subset checks (máximo N itens)
  add({
    id: "proforce-subset-5",
    query: "linha completa pro force todos sabores",
    kind: "subsetOf",
    ids: GRUPOS.proForce,
    min: 5,
    max: 5,
  });

  // Pedidos com "growth" ambíguo (creatina growth vs whey growth)
  add({
    id: "growth-ambigu creatina",
    query: "post creatina growth promo",
    kind: "exact",
    ids: ["creatina-growth"],
    forbidden: GRUPOS.wheys,
  });
  add({
    id: "growth-ambigu whey",
    query: "post whey growth promo",
    kind: "includesAll",
    ids: GRUPOS.wheys,
  });
  add({
    id: "growth-whey-generico",
    query: "promocao whey growth",
    kind: "includesAll",
    ids: GRUPOS.wheys,
  });

  // Mais variações até passar de 100
  const extras = [
    { q: "kit pro force 4 sabores academias", ids: ["pf-kit4"] },
    { q: "energy drink monster lata", ids: GRUPOS.monster },
    { q: "suplemento creatina em pó max", ids: ["creatina-max"] },
    { q: "naked wafer barrinha proteina", ids: GRUPOS.barras },
    { q: "pro force e monster no mesmo post", ids: [...GRUPOS.proForce, ...GRUPOS.monster] },
  ];
  for (const { q, ids } of extras) {
    if (cases.length >= 100) break;
    add({
      id: `extra-${cases.length}`,
      query: q,
      kind: ids.length > 1 ? "includesAll" : "includesAll",
      ids,
    });
  }

  // Fill remaining with pro force + whey permutations
  const pfSubset = GRUPOS.proForce;
  const wheySubset = GRUPOS.wheys;
  let n = 0;
  while (cases.length < 100 && n < 30) {
    const pf = pfSubset[n % pfSubset.length];
    const whey = wheySubset[n % wheySubset.length];
    add({
      id: `perm-${cases.length}`,
      query: `promo ${pf.replace("pf-", "pro force ")} com ${whey.replace("whey-", "whey ")}`,
      kind: "exact",
      ids: [pf, whey],
    });
    n += 1;
  }

  return cases.slice(0, 100);
}

const ALL_CASES = buildCases();

describe("productSearch combinatório (~100 casos)", () => {
  it(`executa ${ALL_CASES.length} cenários no acervo de suplementos`, (t) => {
    const results = [];
    let passed = 0;

    for (const c of ALL_CASES) {
      const r = evaluateCase(c);
      results.push({ ...c, ...r });
      if (r.ok) passed += 1;
    }

    const failed = results.filter((r) => !r.ok);
    const byMode = results.reduce((acc, r) => {
      acc[r.mode] = (acc[r.mode] || 0) + 1;
      return acc;
    }, {});

    const report = {
      total: ALL_CASES.length,
      passed,
      failed: failed.length,
      taxa: `${((passed / ALL_CASES.length) * 100).toFixed(1)}%`,
      modos: byMode,
      falhas: failed.slice(0, 25).map((f) => ({
        id: f.id,
        query: f.query.slice(0, 70),
        reason: f.reason,
        veio: f.ids,
        mode: f.mode,
      })),
    };

    t.diagnostic(JSON.stringify(report, null, 2));

    if (failed.length) {
      const msg = failed
        .slice(0, 8)
        .map((f) => `[${f.id}] ${f.reason}`)
        .join("\n");
      assert.fail(`${failed.length}/${ALL_CASES.length} falharam. Primeiras:\n${msg}`);
    }

    assert.equal(passed, ALL_CASES.length);
  });
});
