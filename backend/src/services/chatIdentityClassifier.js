/**
 * Compat: reexporta classificador amplo de perfil geral (vários temas).
 */

export {
  NEGOCIO_TUMA_BLOCK_RE,
  isPerfilGeralQuestion,
  isPerfilGeralQuestion as isIdentityFamilyQuestion,
  classifyPerfilGeralTheme,
  classifyIdentityIntent,
  buildPerfilGeralLlmPromptBlock,
  buildPerfilGeralLlmPromptBlock as buildIdentityLlmPromptBlock,
  tryPerfilGeralDirectResponse,
  PERFIL_GERAL_THEMES,
} from "./chatPerfilGeralThemes.js";
