import { env } from "../config.js";
import { isDonoPlataforma } from "../modules/auth/plataformaAdmin.js";

/**
 * Depois de requireUserJwt + requireUsuario: só dono da plataforma (TumaCore).
 */
export function requireDonoPlataforma(req, res, next) {
  if (!isDonoPlataforma(req.usuario, env.TUMAIA_PLATAFORMA_ADMIN_EMAILS)) {
    res.status(403).json({ error: "Acesso restrito à área TumaCore (plataforma)." });
    return;
  }
  next();
}
