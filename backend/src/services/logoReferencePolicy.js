/**
 * Logo da identidade: canto discreto por padrão; protagonista só se o cliente pedir.
 */

/** Cliente quer o logo como elemento principal da arte (não só cantinho). */
export const LOGO_AS_HERO_HINT =
  /logo\s+(em\s+)?(destaque|principal|protagonista|grande|no\s+centro|hero|herói)|destaque\s+(no\s+)?logo|arte\s+(da|de|com)\s+(o\s+)?logo|foco\s+(na|no)\s+logo|só\s+o\s+logo|somente\s+o\s+logo|logo\s+como\s+(foco|protagonista|principal)|marca\s+em\s+destaque|post\s+(da|de)\s+marca\s+(sem\s+produto)?/i;

/**
 * @param {string} [userHint]
 */
export function wantsLogoAsHero(userHint) {
  return LOGO_AS_HERO_HINT.test(String(userHint || ""));
}
