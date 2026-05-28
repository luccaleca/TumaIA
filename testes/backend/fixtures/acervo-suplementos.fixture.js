/**
 * Catálogo espelhando o acervo real do usuário (nomes para testes combinatórios).
 */

export const ACERVO_SUPLEMENTOS = [
  { id: "creatina-max", nome_exibicao: "creatina max", nome_arquivo: "creatina-max.png", tipo_midia: "imagem" },
  { id: "creatina-growth", nome_exibicao: "creatina growth", nome_arquivo: "creatina-growth.png", tipo_midia: "imagem" },
  { id: "creatina-integral", nome_exibicao: "creatina integral", nome_arquivo: "creatina-integral.png", tipo_midia: "imagem" },
  { id: "monster", nome_exibicao: "Monster Energy 473ml", nome_arquivo: "monster-energy-lata.png", tipo_midia: "imagem" },
  { id: "pf-morango", nome_exibicao: "pro force morango", nome_arquivo: "pro-force-morango.png", tipo_midia: "imagem" },
  { id: "pf-chocolate", nome_exibicao: "pro force chocolate", nome_arquivo: "pro-force-chocolate.png", tipo_midia: "imagem" },
  { id: "pf-cookies", nome_exibicao: "pro force cookies", nome_arquivo: "pro-force-cookies.png", tipo_midia: "imagem" },
  { id: "pf-kit4", nome_exibicao: "pro force kit 4 sabores", nome_arquivo: "pro-force-conjunto-4.png", tipo_midia: "imagem" },
  { id: "pf-cafe", nome_exibicao: "pro force cafe", nome_arquivo: "pro-force-cafe.png", tipo_midia: "imagem" },
  { id: "barra-dark", nome_exibicao: "naked wafer dark chocolate", nome_arquivo: "barra-naked-dark-chocolate.png", tipo_midia: "imagem" },
  { id: "barra-canela", nome_exibicao: "naked wafer cinnamon", nome_arquivo: "barra-naked-cinnamon.png", tipo_midia: "imagem" },
  { id: "barra-branco", nome_exibicao: "naked wafer chocolate branco", nome_arquivo: "barra-naked-branco.png", tipo_midia: "imagem" },
  { id: "barra-avela", nome_exibicao: "naked wafer avela", nome_arquivo: "barra-naked-avela.png", tipo_midia: "imagem" },
  { id: "whey-cookies", nome_exibicao: "whey growth cookies", nome_arquivo: "whey-growth-cookies.png", tipo_midia: "imagem" },
  { id: "whey-chocolate", nome_exibicao: "whey growth chocolate", nome_arquivo: "whey-growth-chocolate.png", tipo_midia: "imagem" },
  { id: "whey-baunilha", nome_exibicao: "whey growth baunilha", nome_arquivo: "whey-growth-baunilha.png", tipo_midia: "imagem" },
];

export const GRUPOS = {
  creatinas: ["creatina-max", "creatina-growth", "creatina-integral"],
  monster: ["monster"],
  proForce: ["pf-morango", "pf-chocolate", "pf-cookies", "pf-kit4", "pf-cafe"],
  barras: ["barra-dark", "barra-canela", "barra-branco", "barra-avela"],
  wheys: ["whey-cookies", "whey-chocolate", "whey-baunilha"],
  saborCookies: ["pf-cookies", "whey-cookies"],
  saborChocolate: ["pf-chocolate", "whey-chocolate", "barra-dark"],
  saborBaunilha: ["whey-baunilha"],
  bebidas: ["monster", "pf-cafe", "whey-cookies", "whey-chocolate", "whey-baunilha"],
};
