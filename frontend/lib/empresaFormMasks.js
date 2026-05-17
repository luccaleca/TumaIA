export function onlyDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

export function formatTelefone(value) {
  const d = onlyDigits(value).slice(0, 11);
  if (!d) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function formatCnpj(value) {
  const d = onlyDigits(value).slice(0, 14);
  if (!d) return "";
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

export function stripInstagramAt(value) {
  return String(value || "")
    .trim()
    .replace(/^@+/, "")
    .replace(/\s+/g, "");
}

export function normalizeInstagramForApi(value) {
  const u = stripInstagramAt(value);
  return u || null;
}

export function normalizeTelefoneForApi(value) {
  const d = onlyDigits(value);
  return d || null;
}

export function normalizeCnpjForApi(value) {
  const d = onlyDigits(value);
  return d || null;
}

export const emptyEmpresaFields = {
  nome_fantasia: "",
  razao_social: "",
  descricao: "",
  instagram_empresa: "",
  telefone_principal: "",
  segmento: "",
  cnpj: "",
  email_principal: "",
};

export function formatEmpresaFormFromApi(empresa) {
  if (!empresa) return {};
  return {
    telefone_principal: formatTelefone(empresa.telefone_principal || ""),
    cnpj: formatCnpj(empresa.cnpj || ""),
    instagram_empresa: stripInstagramAt(empresa.instagram_empresa || ""),
  };
}

export function empresaToFormFields(empresa) {
  if (!empresa) return { ...emptyEmpresaFields };
  const masked = formatEmpresaFormFromApi(empresa);
  return {
    nome_fantasia: empresa.nome_fantasia || "",
    razao_social: empresa.razao_social || "",
    descricao: empresa.descricao || "",
    instagram_empresa: masked.instagram_empresa || "",
    telefone_principal: masked.telefone_principal || "",
    segmento: empresa.segmento || "",
    cnpj: masked.cnpj || "",
    email_principal: empresa.email_principal || "",
  };
}

/** Valor interno do select para categoria digitada pelo usuário. */
export const SEGMENTO_OPCAO_PERSONALIZADA = "__segmento_personalizado__";

export function segmentoEstaNaLista(segmento) {
  const v = String(segmento || "").trim();
  return v.length > 0 && SEGMENTOS_SUGERIDOS.includes(v);
}

/** Categorias de mercado (não tipo de estabelecimento). */
export const SEGMENTOS_SUGERIDOS = [
  "Saúde",
  "Beleza",
  "Eletrônicos",
  "Moda",
  "Alimentação",
  "Casa e decoração",
  "Automotivo",
  "Esportes",
  "Educação",
  "Tecnologia",
  "Pets",
  "Infantil",
  "Serviços",
  "Financeiro",
  "Entretenimento",
];
