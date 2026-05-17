import { Router } from "express";
import { requireUserJwt } from "../../middleware/requireUserJwt.js";
import { requireUsuario } from "../../middleware/requireUsuario.js";
import { registerConvitesRoutes } from "./convites.routes.js";
import { registerContextosRoutes } from "./contextos.routes.js";
import { registerIdentidadeRoutes } from "./identidade.routes.js";
import { registerEmpresaCoreRoutes } from "./empresa.routes.js";
import { registerMembrosRoutes } from "./membros.routes.js";
import { registerMidiasRoutes } from "./midias.routes.js";
import { registerPastasRoutes } from "./pastas.routes.js";

const r = Router();

r.use(requireUserJwt);
r.use(requireUsuario);

/** Ordem importa: rotas literais (`/convites/resgatar`, `/minhas`) antes de `/:idEmpresa`. */
registerConvitesRoutes(r);
registerEmpresaCoreRoutes(r);
registerMembrosRoutes(r);
registerContextosRoutes(r);
registerIdentidadeRoutes(r);
registerPastasRoutes(r);
registerMidiasRoutes(r);

export default r;
