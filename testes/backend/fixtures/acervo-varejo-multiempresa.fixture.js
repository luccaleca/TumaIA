/**
 * Acervos multiempresa / multicategoria para generalização.
 * Cada empresa tem só o próprio cadastro — sem regra por categoria.
 */

/**
 * @typedef {{
 *   id: string,
 *   nome_exibicao: string,
 *   nome_arquivo: string,
 *   tipo_midia?: string,
 *   descricao?: string,
 *   alt_text?: string,
 * }} MidiaFixture
 */

/**
 * @typedef {{
 *   id_empresa: string,
 *   nome: string,
 *   categoria_exemplo: string,
 *   midias: MidiaFixture[],
 * }} EmpresaFixture
 */

/** @type {EmpresaFixture} */
export const EMPRESA_SUPLEMENTOS = {
  id_empresa: "emp-suplementos",
  nome: "Force Nutri",
  categoria_exemplo: "suplementos",
  midias: [
    {
      id: "pf-morango",
      nome_exibicao: "pro force morango",
      nome_arquivo: "pro-force-morango.png",
      tipo_midia: "imagem",
    },
    {
      id: "pf-chocolate",
      nome_exibicao: "pro force chocolate",
      nome_arquivo: "pro-force-chocolate.png",
      tipo_midia: "imagem",
    },
    {
      id: "creatina-limao",
      nome_exibicao: "creatina limao",
      nome_arquivo: "creatina-limao.png",
      descricao: "creatina sabor limao",
      tipo_midia: "imagem",
    },
    {
      id: "creatina-max",
      nome_exibicao: "creatina max",
      nome_arquivo: "creatina-max.png",
      tipo_midia: "imagem",
    },
    {
      id: "whey-chocolate",
      nome_exibicao: "whey growth chocolate",
      nome_arquivo: "whey-growth-chocolate.png",
      tipo_midia: "imagem",
    },
  ],
};

/** @type {EmpresaFixture} */
export const EMPRESA_ROUPAS = {
  id_empresa: "emp-roupas",
  nome: "Ateliê Linha",
  categoria_exemplo: "roupas",
  midias: [
    {
      id: "camiseta-preta",
      nome_exibicao: "camiseta preta",
      nome_arquivo: "camiseta-preta.png",
      descricao: "camiseta algodao cor preta",
      tipo_midia: "imagem",
    },
    {
      id: "camiseta-branca",
      nome_exibicao: "camiseta branca",
      nome_arquivo: "camiseta-branca.png",
      tipo_midia: "imagem",
    },
    {
      id: "jaqueta-jeans",
      nome_exibicao: "jaqueta jeans",
      nome_arquivo: "jaqueta-jeans.png",
      tipo_midia: "imagem",
    },
    {
      id: "vestido-longo",
      nome_exibicao: "vestido longo",
      nome_arquivo: "vestido-longo.png",
      descricao: "vestido elegante longo",
      tipo_midia: "imagem",
    },
    {
      id: "tenis-branco-42",
      nome_exibicao: "tenis branco 42",
      nome_arquivo: "tenis-branco-42.png",
      descricao: "tenis branco tamanho 42",
      tipo_midia: "imagem",
    },
  ],
};

/** @type {EmpresaFixture} */
export const EMPRESA_COSMETICOS = {
  id_empresa: "emp-cosmeticos",
  nome: "Aura Beleza",
  categoria_exemplo: "cosmeticos",
  midias: [
    {
      id: "perfume-100ml",
      nome_exibicao: "perfume floral 100ml",
      nome_arquivo: "perfume-floral-100ml.png",
      descricao: "perfume floral volume 100ml",
      tipo_midia: "imagem",
    },
    {
      id: "perfume-50ml",
      nome_exibicao: "perfume floral 50ml",
      nome_arquivo: "perfume-floral-50ml.png",
      tipo_midia: "imagem",
    },
    {
      id: "hidratante-rose",
      nome_exibicao: "hidratante rose",
      nome_arquivo: "hidratante-rose.png",
      tipo_midia: "imagem",
    },
    {
      id: "batom-vermelho",
      nome_exibicao: "batom vermelho",
      nome_arquivo: "batom-vermelho.png",
      tipo_midia: "imagem",
    },
  ],
};

/** @type {EmpresaFixture} */
export const EMPRESA_ELETRONICOS = {
  id_empresa: "emp-eletronicos",
  nome: "Byte Casa",
  categoria_exemplo: "eletronicos",
  midias: [
    {
      id: "fone-bluetooth",
      nome_exibicao: "fone bluetooth",
      nome_arquivo: "fone-bluetooth.png",
      tipo_midia: "imagem",
    },
    {
      id: "celular-azul",
      nome_exibicao: "celular azul",
      nome_arquivo: "celular-azul.png",
      descricao: "smartphone cor azul",
      tipo_midia: "imagem",
    },
    {
      id: "notebook-14",
      nome_exibicao: "notebook 14",
      nome_arquivo: "notebook-14.png",
      descricao: "notebook 14 polegadas",
      tipo_midia: "imagem",
    },
    {
      id: "teclado-mecanico",
      nome_exibicao: "teclado mecanico",
      nome_arquivo: "teclado-mecanico.png",
      tipo_midia: "imagem",
    },
  ],
};

/** @type {EmpresaFixture} */
export const EMPRESA_ALIMENTOS = {
  id_empresa: "emp-alimentos",
  nome: "Mercado Bom Dia",
  categoria_exemplo: "alimentos",
  midias: [
    {
      id: "chocolate-leite",
      nome_exibicao: "chocolate ao leite",
      nome_arquivo: "chocolate-ao-leite.png",
      tipo_midia: "imagem",
    },
    {
      id: "cafe-torrado",
      nome_exibicao: "cafe torrado",
      nome_arquivo: "cafe-torrado.png",
      descricao: "cafe torrado moagem media",
      tipo_midia: "imagem",
    },
    {
      id: "biscoito-recheado",
      nome_exibicao: "biscoito recheado",
      nome_arquivo: "biscoito-recheado.png",
      tipo_midia: "imagem",
    },
    {
      id: "suco-laranja-1l",
      nome_exibicao: "suco laranja 1l",
      nome_arquivo: "suco-laranja-1l.png",
      descricao: "suco de laranja 1 litro",
      tipo_midia: "imagem",
    },
    {
      id: "cerveja-pilsen",
      nome_exibicao: "cerveja pilsen",
      nome_arquivo: "cerveja-pilsen.png",
      tipo_midia: "imagem",
    },
  ],
};

/** @type {EmpresaFixture} */
export const EMPRESA_PET = {
  id_empresa: "emp-pet",
  nome: "Pet Amigo",
  categoria_exemplo: "pet",
  midias: [
    {
      id: "racao-cao-adulto",
      nome_exibicao: "racao cao adulto",
      nome_arquivo: "racao-cao-adulto.png",
      descricao: "racao para cachorro adulto",
      tipo_midia: "imagem",
    },
    {
      id: "racao-gato",
      nome_exibicao: "racao gato",
      nome_arquivo: "racao-gato.png",
      tipo_midia: "imagem",
    },
    {
      id: "brinquedo-osso",
      nome_exibicao: "brinquedo osso",
      nome_arquivo: "brinquedo-osso.png",
      tipo_midia: "imagem",
    },
  ],
};

/** @type {EmpresaFixture} */
export const EMPRESA_CASA = {
  id_empresa: "emp-casa",
  nome: "Casa Clara",
  categoria_exemplo: "casa",
  midias: [
    {
      id: "sofa-3-lugares",
      nome_exibicao: "sofa 3 lugares",
      nome_arquivo: "sofa-3-lugares.png",
      descricao: "sofa tres lugares tecido",
      tipo_midia: "imagem",
    },
    {
      id: "luminaria-mesa",
      nome_exibicao: "luminaria de mesa",
      nome_arquivo: "luminaria-mesa.png",
      tipo_midia: "imagem",
    },
    {
      id: "manta-inverno",
      nome_exibicao: "manta inverno",
      nome_arquivo: "manta-inverno.png",
      tipo_midia: "imagem",
    },
  ],
};

/** @type {EmpresaFixture} */
export const EMPRESA_AUTOMOTIVO = {
  id_empresa: "emp-auto",
  nome: "Auto Peças Norte",
  categoria_exemplo: "automotivo",
  midias: [
    {
      id: "pneu-aro-16",
      nome_exibicao: "pneu aro 16",
      nome_arquivo: "pneu-aro-16.png",
      tipo_midia: "imagem",
    },
    {
      id: "capa-banco",
      nome_exibicao: "capa de banco",
      nome_arquivo: "capa-banco.png",
      tipo_midia: "imagem",
    },
  ],
};

/** @type {EmpresaFixture} */
export const EMPRESA_PAPELARIA = {
  id_empresa: "emp-papelaria",
  nome: "Papel & Cia",
  categoria_exemplo: "papelaria",
  midias: [
    {
      id: "caderno-universitario",
      nome_exibicao: "caderno universitario",
      nome_arquivo: "caderno-universitario.png",
      tipo_midia: "imagem",
    },
    {
      id: "caneta-gel-azul",
      nome_exibicao: "caneta gel azul",
      nome_arquivo: "caneta-gel-azul.png",
      tipo_midia: "imagem",
    },
  ],
};

/**
 * Empresa pequena para o cenário “acabou de cadastrar produto C”.
 * @type {EmpresaFixture}
 */
export const EMPRESA_PRODUTO_NOVO_BASE = {
  id_empresa: "emp-produto-novo",
  nome: "Loja Em Expansão",
  categoria_exemplo: "mista",
  midias: [
    {
      id: "produto-a-vela",
      nome_exibicao: "vela aromatica lavanda",
      nome_arquivo: "vela-lavanda.png",
      tipo_midia: "imagem",
    },
    {
      id: "produto-b-sabonete",
      nome_exibicao: "sabonete artesanal",
      nome_arquivo: "sabonete-artesanal.png",
      tipo_midia: "imagem",
    },
  ],
};

/** Produto C cadastrado depois — nunca visto pelo código de categoria. */
export const PRODUTO_C_NOVO = {
  id: "produto-c-diffuser",
  nome_exibicao: "diffuser ultrasonic mist",
  nome_arquivo: "diffuser-ultrasonic-mist.png",
  descricao: "diffuser ultrasonic mist edition",
  tipo_midia: "imagem",
};

/** Todas as empresas de varejo usadas na bateria de generalização. */
export const EMPRESAS_VAREJO = [
  EMPRESA_SUPLEMENTOS,
  EMPRESA_ROUPAS,
  EMPRESA_COSMETICOS,
  EMPRESA_ELETRONICOS,
  EMPRESA_ALIMENTOS,
  EMPRESA_PET,
  EMPRESA_CASA,
  EMPRESA_AUTOMOTIVO,
  EMPRESA_PAPELARIA,
];

/**
 * @param {MidiaFixture[]} midias
 */
export function toTenantMidias(midias) {
  return (midias || []).map((r) => ({
    id_midia: r.id,
    nome_exibicao: r.nome_exibicao,
    nome_arquivo: r.nome_arquivo,
    tipo_midia: r.tipo_midia || "imagem",
    ...(r.descricao ? { descricao: r.descricao } : {}),
    ...(r.alt_text ? { alt_text: r.alt_text } : {}),
  }));
}

/**
 * Intenções iguais em qualquer tenant — o acervo decide o resultado.
 */
export const INTENCOES_COMPARTILHADAS = [
  "faz uma promoção desse produto",
  "quero uma arte nova desse",
  "divulga o produto novo",
  "faz algo mais premium",
  "coloca o preço grande",
];
