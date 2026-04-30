    const API_BASE_OVERRIDE = "";

    const LS_API = "tuma_demo_api_base";
    const TOKEN_KEY = "tuma_demo_access_token";
    const LEGACY_EMPRESA_KEY = "tuma_demo_empresa_profile";
    /** Quando o usuário escolhe «Cadastrar minha empresa» sem ter perfil salvo ainda. */
    const EMPRESA_FORM_OPEN_KEY = "tuma_demo_empresa_abrir_form";

    const $ = (id) => document.getElementById(id);

    function getApiBase() {
      if (API_BASE_OVERRIDE) return String(API_BASE_OVERRIDE).replace(/\/$/, "");
      if (typeof location !== "undefined" && location.origin && location.origin !== "null") {
        return location.origin.replace(/\/$/, "");
      }
      const ls = localStorage.getItem(LS_API);
      if (ls) return ls.replace(/\/$/, "");
      return "http://localhost:4000";
    }

    function normalizeEmailClient(s) {
      return typeof s === "string" ? s.trim().toLowerCase() : s;
    }

    let session = null;
    let empresaProfile = null;
    let empresaEditMode = false;
    let empresaMembros = [];
    let usuarioAtualId = null;
    let meuCargoEmpresa = null;

    function loadTokenFromStorage() {
      try {
        return sessionStorage.getItem(TOKEN_KEY);
      } catch {
        return null;
      }
    }

    function clearLegacyEmpresaStorage() {
      try {
        localStorage.removeItem(LEGACY_EMPRESA_KEY);
      } catch {
        /* ignore */
      }
    }

    function saveToken(token) {
      try {
        if (token) sessionStorage.setItem(TOKEN_KEY, token);
        else sessionStorage.removeItem(TOKEN_KEY);
      } catch {
        /* ignore */
      }
    }

    function setTopNavActive(which) {
      $("navLogin").classList.toggle("is-active", which === "login");
      $("navCadastro").classList.toggle("is-active", which === "cadastro");
      $("navPlanos").classList.toggle("is-active", which === "planos");
    }

    function showView(name) {
      const authOnlyViews = new Set(["empresa", "config", "contextos", "midias"]);
      if (
        authOnlyViews.has(name) &&
        (!session?.access_token || usuarioAtualId == null)
      ) {
        name = "login";
      }
      ["view-login", "view-cadastro", "view-planos", "view-empresa", "view-config", "view-contextos", "view-midias"].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.classList.toggle("is-active", id === `view-${name}`);
      });
      $("navEmpresa").classList.toggle("is-active", name === "empresa");
      $("navConfig").classList.toggle("is-active", name === "config");
      $("navContextos").classList.toggle("is-active", name === "contextos");
      $("navMidias").classList.toggle("is-active", name === "midias");
      if (name !== "contextos" && $("ctxPicker")) resetCtxPickerUi();
      if (name === "login") setTopNavActive("login");
      else if (name === "cadastro") setTopNavActive("cadastro");
      else if (name === "planos") setTopNavActive("planos");
      else if (name === "empresa" || name === "config" || name === "contextos" || name === "midias") {
        $("navLogin").classList.remove("is-active");
        $("navCadastro").classList.remove("is-active");
        $("navPlanos").classList.remove("is-active");
      }
      if (name === "midias") renderMidiasExplorer();
      if (name === "empresa") renderEmpresaUi();
    }

    function setUiLogged(on) {
      $("btnContaEditar").disabled = !on;
      $("btnContaSalvar").disabled = !on;
      $("btnEmpresaSalvar").disabled = !on;
      $("navEmpresa").disabled = !on;
      $("navConfig").disabled = !on;
      $("navContextos").disabled = !on;
      $("navMidias").disabled = !on;
      $("navLogout").hidden = !on;
      $("navLogin").hidden = on;
      $("navCadastro").hidden = on;
      $("navUserGreeting").hidden = !on;
      $("navPlanos").hidden = on;
      if (!on) {
        $("navUserName").textContent = "—";
      }
    }

    function normalizeEmpresaProfile(raw) {
      if (!raw || typeof raw !== "object") return null;
      return {
        id_empresa: raw.id_empresa || null,
        nome_fantasia: String(raw.nome_fantasia || "").trim(),
        razao_social: String(raw.razao_social || "").trim(),
        descricao: String(raw.descricao || "").trim(),
        instagram_empresa: String(raw.instagram_empresa || "").trim(),
        telefone_principal: String(raw.telefone_principal || "").trim(),
        segmento: String(raw.segmento || "").trim(),
        cnpj: String(raw.cnpj || "").trim(),
        email_principal: String(raw.email_principal || "").trim(),
        nome_contato_principal: String(raw.nome_contato_principal || "").trim(),
        plano_codigo: raw.plano_codigo === "teste_gratuito" ? "teste_gratuito" : "nenhum",
        plano_status:
          raw.plano_status === "trial" ||
          raw.plano_status === "ativo" ||
          raw.plano_status === "cancelado" ||
          raw.plano_status === "sem_plano"
            ? raw.plano_status
            : "sem_plano",
        updated_at: raw.updated_at || null,
      };
    }

    function loadEmpresaFromStorage() {
      return null;
    }

    function saveEmpresaToStorage(_obj) {
      /* desativado: empresa agora vem do backend por conta logada */
    }

    async function loadEmpresaAtual() {
      if (!session?.access_token) {
        empresaProfile = null;
        empresaMembros = [];
        meuCargoEmpresa = null;
        renderEmpresaUi();
        return null;
      }
      const result = await apiFetch("/empresas/minhas");
      if (!result.ok || result.networkError) {
        empresaProfile = null;
        empresaMembros = [];
        meuCargoEmpresa = null;
        renderEmpresaUi();
        return result;
      }
      const lista = Array.isArray(result.json?.empresas) ? result.json.empresas : [];
      const atual = lista[0] || null;
      const emp = atual?.empresa;
      meuCargoEmpresa = normalizeCargoKey(atual?.papel);
      empresaProfile = normalizeEmpresaProfile(emp && typeof emp === "object" ? emp : null);
      await loadEmpresaMembros(empresaProfile?.id_empresa);
      renderEmpresaUi();
      const vm = $("view-midias");
      if (vm?.classList.contains("is-active")) {
        aplicarPermissoesMidiasUi();
        renderMidiasExplorer();
      }
      const vc = $("view-contextos");
      if (vc?.classList.contains("is-active")) {
        await loadContextosData();
      }
      return result;
    }

    function normalizeInstagram(v) {
      const raw = String(v || "").trim();
      if (!raw) return "";
      return raw.startsWith("@") ? raw : `@${raw}`;
    }

    function labelPlanoNome(codigo) {
      if (codigo === "teste_gratuito") return "Teste gratuito";
      return "Nenhum";
    }

    function labelPlanoStatus(status) {
      if (status === "trial") return "Em período de teste";
      if (status === "ativo") return "Ativo";
      if (status === "cancelado") return "Cancelado";
      return "Sem plano";
    }

    function labelCargo(cargo) {
      if (cargo === "administrador") return "Administrador";
      if (cargo === "editor") return "Editor";
      return "Membro";
    }

    /** Normaliza `papel`/`cargo` da API para comparações estáveis. */
    function normalizeCargoKey(v) {
      if (typeof v !== "string") return null;
      const t = v.trim().toLowerCase();
      return t || null;
    }

    function podeGerenciarMembros() {
      return meuCargoEmpresa === "administrador";
    }

    /** Admin ou editor: pode ver/editar formulário de dados da empresa (membro é só leitura). */
    function podeEditarDadosEmpresa() {
      return meuCargoEmpresa === "administrador" || meuCargoEmpresa === "editor";
    }

    async function alterarCargoMembro(idUsuario, cargo) {
      const idEmpresa = empresaProfile?.id_empresa;
      if (!idEmpresa) return false;
      const result = await apiFetch(`/empresas/${idEmpresa}/membros/${idUsuario}`, {
        method: "PATCH",
        body: JSON.stringify({ cargo }),
      });
      if (!result.ok || result.networkError) {
        const msg =
          result.networkError?.message ||
          (typeof result.json?.error === "string"
            ? result.json.error
            : "Não foi possível atualizar o cargo.");
        window.alert(msg);
        return false;
      }
      await loadEmpresaMembros(idEmpresa);
      return true;
    }

    async function removerMembro(idUsuario) {
      const idEmpresa = empresaProfile?.id_empresa;
      if (!idEmpresa) return false;
      const result = await apiFetch(`/empresas/${idEmpresa}/membros/${idUsuario}`, {
        method: "DELETE",
      });
      if (!result.ok || result.networkError) {
        const msg =
          result.networkError?.message ||
          (typeof result.json?.error === "string"
            ? result.json.error
            : "Não foi possível remover o membro.");
        window.alert(msg);
        return false;
      }
      await loadEmpresaMembros(idEmpresa);
      return true;
    }

    function renderEmpresaMembrosUi() {
      const countEl = $("empresaMembersCount");
      const emptyEl = $("empresaMembersEmpty");
      const listEl = $("empresaMembersList");
      if (!countEl || !emptyEl || !listEl) return;
      const items = Array.isArray(empresaMembros) ? empresaMembros : [];
      countEl.textContent = String(items.length);
      listEl.innerHTML = "";
      if (items.length === 0) {
        emptyEl.hidden = false;
        return;
      }
      emptyEl.hidden = true;
      items.forEach((m) => {
        const li = document.createElement("li");
        li.className = "empresa-member-item";
        const left = document.createElement("div");
        left.className = "empresa-member-main";
        const nome = document.createElement("div");
        nome.className = "empresa-member-name";
        nome.textContent = String(m?.nome || m?.email || "Usuário");
        const email = document.createElement("div");
        email.className = "empresa-member-email";
        email.textContent = String(m?.email || "—");
        left.appendChild(nome);
        left.appendChild(email);
        const right = document.createElement("div");
        right.className = "empresa-member-right";
        const role = document.createElement("span");
        role.className = "empresa-member-role";
        role.textContent = labelCargo(m?.cargo);
        right.appendChild(role);

        const isAdminView = podeGerenciarMembros();
        const isSelf = String(m?.id_usuario || "") === String(usuarioAtualId || "");
        if (isAdminView) {
          const quick = document.createElement("div");
          quick.className = "empresa-member-quick";

          const select = document.createElement("select");
          select.innerHTML = `
            <option value="membro">Membro</option>
            <option value="editor">Editor</option>
            <option value="administrador">Admin</option>
          `;
          select.value = ["membro", "editor", "administrador"].includes(m?.cargo)
            ? m.cargo
            : "membro";
          select.disabled = isSelf;
          select.title = isSelf ? "Você não pode alterar seu próprio cargo aqui" : "Alterar cargo";
          select.addEventListener("change", async () => {
            const ok = await alterarCargoMembro(m.id_usuario, select.value);
            if (!ok) select.value = m?.cargo || "membro";
          });

          const btnRemover = document.createElement("button");
          btnRemover.type = "button";
          btnRemover.className = "empresa-member-btn empresa-member-btn--danger";
          btnRemover.textContent = "Remover";
          btnRemover.disabled = isSelf;
          btnRemover.title = isSelf ? "Você não pode remover a si mesmo" : "Remover membro";
          btnRemover.addEventListener("click", async () => {
            const ok = window.confirm("Deseja remover este membro da empresa?");
            if (!ok) return;
            await removerMembro(m.id_usuario);
          });

          quick.appendChild(select);
          quick.appendChild(btnRemover);
          right.appendChild(quick);
        }

        li.appendChild(left);
        li.appendChild(right);
        listEl.appendChild(li);
      });
    }

    async function loadEmpresaMembros(idEmpresa) {
      if (!idEmpresa || !session?.access_token) {
        empresaMembros = [];
        renderEmpresaMembrosUi();
        return null;
      }
      const result = await apiFetch(`/empresas/${idEmpresa}/membros`);
      if (!result.ok || result.networkError) {
        empresaMembros = [];
        renderEmpresaMembrosUi();
        return result;
      }
      empresaMembros = Array.isArray(result.json?.membros) ? result.json.membros : [];
      renderEmpresaMembrosUi();
      return result;
    }

    function empresaCadastroCompleto(p) {
      const n = normalizeEmpresaProfile(p);
      if (!n) return false;
      return !!(
        n.nome_fantasia &&
        n.razao_social &&
        n.descricao &&
        n.instagram_empresa &&
        n.telefone_principal &&
        n.segmento &&
        n.cnpj &&
        n.email_principal &&
        n.nome_contato_principal
      );
    }

    function usuarioTemEmpresaVinculada() {
      return !!(empresaProfile && (empresaProfile.nome_fantasia || "").trim());
    }

    function empresaDeveMostrarEstadoVazio() {
      if (usuarioTemEmpresaVinculada()) return false;
      try {
        if (sessionStorage.getItem(EMPRESA_FORM_OPEN_KEY) === "1") return false;
      } catch {
        /* ignore */
      }
      return true;
    }

    function renderEmpresaUi() {
      const showEmpty = empresaDeveMostrarEstadoVazio();
      const emptyEl = $("empresaEmptyState");
      const formEl = $("empresaFormSection");
      const summaryEl = $("empresaSummarySection");
      const membersEl = $("empresaMembersSection");
      const editEl = $("empresaEditSection");
      const btnEditar = $("btnEmpresaEditar");
      const btnCancelar = $("btnEmpresaCancelar");
      const btnCriarConvite = $("btnEmpresaCriarConvite");
      const dropConvite = $("empresaConviteDropdown");
      const overlayConvite = $("empresaConviteOverlay");
      if (emptyEl) emptyEl.hidden = !showEmpty;
      if (formEl) formEl.hidden = showEmpty;

      if (showEmpty) {
        empresaEditMode = false;
        empresaMembros = [];
        meuCargoEmpresa = null;
        renderEmpresaMembrosUi();
        const invitePanel = $("empresaInvitePanel");
        const hint = $("empresaConviteHint");
        const conviteInput = $("empConviteCodigo");
        if (invitePanel) invitePanel.hidden = true;
        if (hint) {
          hint.hidden = true;
          hint.textContent = "";
        }
        if (conviteInput) conviteInput.value = "";
        return;
      }

      const has = !!empresaProfile;
      if (has && empresaEditMode && !podeEditarDadosEmpresa()) {
        empresaEditMode = false;
      }
      const showEdit = !has || empresaEditMode;
      const showResumoHead = has && !showEdit;
      const mostrarConviteNaHead = showResumoHead && podeGerenciarMembros();
      const mostrarEditarEmpresaHead = showResumoHead && podeEditarDadosEmpresa();
      if (summaryEl) summaryEl.hidden = !has || showEdit;
      if (membersEl) membersEl.hidden = !has || showEdit;
      if (editEl) editEl.hidden = !showEdit;
      if (btnEditar) btnEditar.hidden = !mostrarEditarEmpresaHead;
      if (btnCancelar) btnCancelar.hidden = !has || !showEdit;
      if (btnCriarConvite) btnCriarConvite.disabled = !has || !empresaProfile?.id_empresa;
      const headActions = $("empresaSummaryHeadActions");
      if (headActions) {
        headActions.hidden = !mostrarEditarEmpresaHead;
      }
      const membrosConviteWrap = $("empresaMembersConviteWrap");
      const btnConviteUsuarios = $("btnEmpresaConviteUsuarios");
      if (membrosConviteWrap) {
        membrosConviteWrap.hidden = !mostrarConviteNaHead;
      }
      if (btnConviteUsuarios) {
        btnConviteUsuarios.disabled = !has || !empresaProfile?.id_empresa;
      }
      if (!has || showEdit) {
        if (dropConvite) dropConvite.hidden = true;
        if (overlayConvite) overlayConvite.hidden = true;
      }
      $("displayEmpresaStatus").textContent = has
        ? "Empresa cadastrada"
        : "Nenhuma empresa cadastrada";
      $("displayEmpresaNome").textContent = has ? (empresaProfile.nome_fantasia || "—") : "—";
      $("displayEmpresaInstagram").textContent = has
        ? (empresaProfile.instagram_empresa || "—")
        : "—";
      $("displayPlanoNome").textContent = has ? labelPlanoNome(empresaProfile.plano_codigo) : "—";
      $("displayPlanoStatus").textContent = has ? labelPlanoStatus(empresaProfile.plano_status) : "—";
      $("empNomeFantasia").value = has ? (empresaProfile.nome_fantasia || "") : "";
      $("empRazaoSocial").value = has ? (empresaProfile.razao_social || "") : "";
      $("empDescricao").value = has ? (empresaProfile.descricao || "") : "";
      $("empCnpj").value = has ? (empresaProfile.cnpj || "") : "";
      $("empInstagram").value = has ? (empresaProfile.instagram_empresa || "") : "";
      $("empTelefone").value = has ? (empresaProfile.telefone_principal || "") : "";
      $("empSegmento").value = has ? (empresaProfile.segmento || "") : "";
      $("empEmailPrincipal").value = has ? (empresaProfile.email_principal || "") : "";
      $("empNomeContato").value = has ? (empresaProfile.nome_contato_principal || "") : "";
      renderEmpresaMembrosUi();
    }

    async function copyTextToClipboard(text) {
      if (!text) return false;
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(text);
          return true;
        }
      } catch {
        /* ignore */
      }
      const tmp = document.createElement("textarea");
      tmp.value = text;
      tmp.setAttribute("readonly", "");
      tmp.style.position = "fixed";
      tmp.style.opacity = "0";
      document.body.appendChild(tmp);
      tmp.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(tmp);
      return ok;
    }

    function exitContaEditMode() {
      $("contaRead").hidden = false;
      $("contaEdit").hidden = true;
      $("btnContaEditar").hidden = false;
    }

    function enterContaEditMode() {
      $("contaRead").hidden = true;
      $("contaEdit").hidden = false;
      $("btnContaEditar").hidden = true;
      setContaMsg("", null);
    }

    function setContaMsg(text, cls) {
      const el = $("contaMsg");
      if (!text) {
        el.hidden = true;
        el.textContent = "";
        el.className = "conta-msg";
        return;
      }
      el.hidden = false;
      el.className = cls ? `conta-msg ${cls}` : "conta-msg";
      el.textContent = text;
    }

    const CTX_LABEL = {
      promocao: "Promoção",
      lancamento: "Lançamento",
      data_comemorativa: "Data comemorativa",
      personalizado: "Personalizado",
    };

    let contextosItems = [];
    let contextoEmEdicaoId = null;
    let contextoSelecionadoId = null;

    let midiasFolders = [];
    let midiasFiles = [];
    let currentMidiasFolderId = null;
    /** Pasta reservada no servidor (“Geral”) para uploads na raiz, sem abrir subpasta. */
    let midiasPastaUploadRaizId = null;
    /** Durante arrastar: `getData` nem sempre existe no `dragover` (ex.: Chrome). */
    let midiasDnDPayload = null;

    function newMidiasId(prefix) {
      return typeof crypto !== "undefined" && crypto.randomUUID
        ? `${prefix}-${crypto.randomUUID()}`
        : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    }

    function stripFileBaseName(name) {
      const i = name.lastIndexOf(".");
      return i > 0 ? name.slice(0, i) : name;
    }

    function midiasFolderExists(parentId, nome) {
      const n = nome.trim().toLowerCase();
      return midiasFolders.some(
        (f) => f.parentId === parentId && f.name.trim().toLowerCase() === n,
      );
    }

    function midiasGetChildFolders(parentId) {
      return midiasFolders.filter((f) => f.parentId === parentId);
    }

    function midiasGetFilesIn(folderId) {
      return midiasFiles.filter((f) => f.folderId === folderId);
    }

    function midiasFolderHasContent(folderId) {
      if (midiasFolders.some((f) => f.parentId === folderId)) return true;
      if (midiasFiles.some((f) => f.folderId === folderId)) return true;
      return false;
    }

    function midiasRevokeAllBlobs() {
      midiasFiles.forEach((f) => {
        if (f.objectUrl && String(f.objectUrl).startsWith("blob:")) {
          URL.revokeObjectURL(f.objectUrl);
        }
      });
    }

    const MIDIAS_DND_KEY = "text/plain";

    function podeOrganizarMidias() {
      return meuCargoEmpresa === "administrador" || meuCargoEmpresa === "editor";
    }

    function aplicarPermissoesMidiasUi() {
      const pode = podeOrganizarMidias();
      const bPasta = $("btnMidiasNovaPasta");
      const bArq = $("btnMidiasAdicionarArquivo");
      const panel = $("midiasNovaPastaPanel");
      const hint = $("midiasReadonlyHint");
      const browse = $("midiasBrowse");
      if (bPasta) bPasta.hidden = !pode;
      if (bArq) bArq.hidden = !pode;
      if (hint) {
        const showReadonly =
          !!empresaProfile?.id_empresa &&
          !!session?.access_token &&
          !pode;
        hint.hidden = !showReadonly;
      }
      if (browse) {
        browse.classList.toggle(
          "midias-browse--readonly",
          !pode && !!empresaProfile?.id_empresa,
        );
      }
      if (!pode && panel) {
        panel.hidden = true;
        const nome = $("midiasNovaPastaNome");
        if (nome) nome.value = "";
        $("btnMidiasNovaPasta")?.classList.remove("is-open");
      }
    }

    async function midiasRenomearPasta(folder) {
      const idEmpresa = empresaProfile?.id_empresa;
      if (!idEmpresa) return;
      const novo = window.prompt("Novo nome da pasta:", folder.name);
      if (novo === null) return;
      const t = novo.trim();
      if (!t || t === folder.name) return;
      if (!currentMidiasFolderId && t.toLowerCase() === "geral") {
        window.alert(
          'O nome "Geral" é reservado para arquivos na tela inicial. Escolha outro nome.',
        );
        return;
      }
      const result = await apiFetch(`/empresas/${idEmpresa}/pastas/${folder.id}`, {
        method: "PATCH",
        body: JSON.stringify({ nome: t }),
      });
      if (!result.ok || result.networkError) {
        const msg =
          result.networkError?.message ||
          (typeof result.json?.error === "string"
            ? result.json.error
            : "Não foi possível renomear a pasta.");
        window.alert(msg);
        return;
      }
      await loadMidiasData();
    }

    async function midiasRenomearMidia(file) {
      const idEmpresa = empresaProfile?.id_empresa;
      if (!idEmpresa) return;
      const novo = window.prompt("Nome para exibição:", file.displayName);
      if (novo === null) return;
      const t = novo.trim();
      if (!t || t === file.displayName) return;
      const result = await apiFetch(`/empresas/${idEmpresa}/midias/${file.id}`, {
        method: "PATCH",
        body: JSON.stringify({ nome_exibicao: t }),
      });
      if (!result.ok || result.networkError) {
        const msg =
          result.networkError?.message ||
          (typeof result.json?.error === "string"
            ? result.json.error
            : "Não foi possível renomear o arquivo.");
        window.alert(msg);
        return;
      }
      await loadMidiasData();
    }

    function parseMidiasDnD(ev) {
      try {
        const raw = ev.dataTransfer.getData(MIDIAS_DND_KEY);
        if (!raw) return null;
        const p = JSON.parse(raw);
        if (!p?.kind || !p?.id) return null;
        if (p.kind !== "folder" && p.kind !== "file") return null;
        return p;
      } catch {
        return null;
      }
    }

    /** `candidata` está na subárvore abaixo de `ancestorId`? (inclui `candidata === ancestorId`.) */
    function midiasPastaEstaNaSubarvore(ancestorId, candidataId) {
      let id = candidataId;
      const seen = new Set();
      while (id) {
        if (id === ancestorId) return true;
        if (seen.has(id)) break;
        seen.add(id);
        const row = midiasFolders.find((x) => x.id === id);
        id = row ? row.parentId : null;
      }
      return false;
    }

    async function midiasApiMoverPasta(idPasta, idPastaPaiDest) {
      const idEmpresa = empresaProfile?.id_empresa;
      if (!idEmpresa) return { ok: false, error: "Sem empresa" };
      return apiFetch(`/empresas/${idEmpresa}/pastas/${idPasta}`, {
        method: "PATCH",
        body: JSON.stringify({ id_pasta_pai: idPastaPaiDest }),
      });
    }

    async function midiasApiMoverMidia(idMidia, idPastaDest) {
      const idEmpresa = empresaProfile?.id_empresa;
      if (!idEmpresa) return { ok: false, error: "Sem empresa" };
      return apiFetch(`/empresas/${idEmpresa}/midias/${idMidia}`, {
        method: "PATCH",
        body: JSON.stringify({ id_pasta: idPastaDest }),
      });
    }

    function setMidiasNovaPastaPanelOpen(open) {
      const panel = $("midiasNovaPastaPanel");
      const btn = $("btnMidiasNovaPasta");
      const nome = $("midiasNovaPastaNome");
      if (panel) panel.hidden = !open;
      if (btn) btn.classList.toggle("is-open", !!open);
      if (open && nome) {
        nome.value = "";
        nome.focus();
      }
    }

    function midiasFinishDragCleanup() {
      midiasDnDPayload = null;
      document.querySelectorAll(".midias-tile--drop-hover").forEach((el) => {
        el.classList.remove("midias-tile--drop-hover");
      });
      document.querySelectorAll(".midias-bc--drop-hover").forEach((el) => {
        el.classList.remove("midias-bc--drop-hover");
      });
    }

    function attachMidiasDnDSource(tile, payload) {
      if (!podeOrganizarMidias()) return;
      tile.draggable = true;
      tile.addEventListener("dragstart", (ev) => {
        midiasDnDPayload = payload;
        ev.dataTransfer.setData(MIDIAS_DND_KEY, JSON.stringify(payload));
        ev.dataTransfer.effectAllowed = "move";
        tile.classList.add("midias-tile--dragging");
      });
      tile.addEventListener("dragend", () => {
        midiasFinishDragCleanup();
        tile.classList.remove("midias-tile--dragging");
        tile.dataset.midiasSkipClick = "1";
        setTimeout(() => {
          delete tile.dataset.midiasSkipClick;
        }, 80);
      });
    }

    function attachMidiasFolderDropTarget(tile, folderId) {
      if (!podeOrganizarMidias()) return;
      tile.addEventListener("dragover", (ev) => {
        const src = midiasDnDPayload;
        if (!src) return;
        if (src.kind === "folder") {
          if (src.id === folderId) return;
          if (midiasPastaEstaNaSubarvore(src.id, folderId)) return;
        } else if (src.kind === "file") {
          const f = midiasFiles.find((x) => x.id === src.id);
          if (f && f.folderId === folderId) return;
        }
        ev.preventDefault();
        ev.dataTransfer.dropEffect = "move";
        tile.classList.add("midias-tile--drop-hover");
      });
      tile.addEventListener("dragleave", () => {
        tile.classList.remove("midias-tile--drop-hover");
      });
      tile.addEventListener("drop", async (ev) => {
        tile.classList.remove("midias-tile--drop-hover");
        ev.preventDefault();
        const src = midiasDnDPayload || parseMidiasDnD(ev);
        if (!src) return;
        if (src.kind === "folder") {
          if (src.id === folderId) return;
          if (midiasPastaEstaNaSubarvore(src.id, folderId)) {
            window.alert("Não dá para colocar uma pasta dentro dela mesma.");
            return;
          }
          const moved = midiasFolders.find((x) => x.id === src.id);
          if (moved && moved.parentId === folderId) return;
          const result = await midiasApiMoverPasta(src.id, folderId);
          if (!result.ok || result.networkError) {
            const msg =
              result.networkError?.message ||
              (typeof result.json?.error === "string"
                ? result.json.error
                : "Não foi possível mover a pasta.");
            window.alert(msg);
            return;
          }
        } else if (src.kind === "file") {
          const file = midiasFiles.find((x) => x.id === src.id);
          if (!file || file.folderId === folderId) return;
          const result = await midiasApiMoverMidia(src.id, folderId);
          if (!result.ok || result.networkError) {
            const msg =
              result.networkError?.message ||
              (typeof result.json?.error === "string"
                ? result.json.error
                : "Não foi possível mover o arquivo.");
            window.alert(msg);
            return;
          }
        }
        midiasDnDPayload = null;
        await loadMidiasData();
      });
    }

    function closeMidiasPreview() {
      const overlay = $("midiasPreviewOverlay");
      const image = $("midiasPreviewImage");
      if (overlay) overlay.hidden = true;
      if (image) {
        image.hidden = true;
        image.src = "";
      }
    }

    function openMidiasPreview(file) {
      if (!file || file.kind !== "image" || !file.objectUrl) return;
      const overlay = $("midiasPreviewOverlay");
      const image = $("midiasPreviewImage");
      if (!overlay || !image) return;
      image.src = file.objectUrl;
      image.hidden = false;
      overlay.hidden = false;
    }

    async function loadMidiasData() {
      const idEmpresa = empresaProfile?.id_empresa;
      if (!session?.access_token || !idEmpresa) {
        midiasRevokeAllBlobs();
        midiasFolders = [];
        midiasFiles = [];
        midiasPastaUploadRaizId = null;
        currentMidiasFolderId = null;
        renderMidiasExplorer();
        return;
      }
      const [pastasRes, midiasRes] = await Promise.all([
        apiFetch(`/empresas/${idEmpresa}/pastas`),
        apiFetch(`/empresas/${idEmpresa}/midias`),
      ]);
      if (!pastasRes.ok || pastasRes.networkError) {
        window.alert(
          `[Mídias] Falha ao carregar pastas: ${pastasRes.networkError?.message || pastasRes.json?.error || "erro desconhecido"}`,
        );
        return;
      }
      if (!midiasRes.ok || midiasRes.networkError) {
        window.alert(
          `[Mídias] Falha ao carregar arquivos: ${midiasRes.networkError?.message || midiasRes.json?.error || "erro desconhecido"}`,
        );
        return;
      }
      midiasRevokeAllBlobs();
      midiasPastaUploadRaizId = pastasRes.json?.id_pasta_upload_raiz || null;
      midiasFolders = (pastasRes.json?.pastas || []).map((p) => ({
        id: p.id_pasta,
        parentId: p.id_pasta_pai || null,
        name: p.nome,
      }));
      midiasFiles = (midiasRes.json?.midias || []).map((m) => ({
        id: m.id_midia,
        folderId: m.id_pasta,
        displayName: m.nome_exibicao || stripFileBaseName(m.nome_arquivo || ""),
        objectUrl: m.url_arquivo || null,
        kind: m.tipo_midia === "video" ? "video" : "image",
        fileName: m.nome_arquivo || "",
      }));
      if (currentMidiasFolderId && !midiasFolders.some((f) => f.id === currentMidiasFolderId)) {
        currentMidiasFolderId = null;
      }
      renderMidiasExplorer();
    }

    async function uploadMidiaArquivo(file) {
      if (!podeOrganizarMidias()) {
        window.alert("Sem permissão para enviar arquivos.");
        return false;
      }
      const idEmpresa = empresaProfile?.id_empresa;
      if (!idEmpresa) {
        window.alert("Empresa não identificada para upload.");
        return false;
      }
      const isVid = file.type.startsWith("video/");
      const base64Data = await new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => {
          const raw = String(fr.result || "");
          const comma = raw.indexOf(",");
          resolve(comma >= 0 ? raw.slice(comma + 1) : raw);
        };
        fr.onerror = () => reject(fr.error || new Error("Falha ao ler arquivo"));
        fr.readAsDataURL(file);
      });
      const idPasta =
        currentMidiasFolderId || midiasPastaUploadRaizId || null;
      const payload = {
        nome_arquivo: file.name,
        nome_exibicao: stripFileBaseName(file.name),
        tipo_midia: isVid ? "video" : "imagem",
        mime_type: file.type || (isVid ? "video/mp4" : "image/jpeg"),
        base64_data: base64Data,
      };
      if (idPasta) payload.id_pasta = idPasta;
      const result = await apiFetch(`/empresas/${idEmpresa}/midias/upload-base64`, {
        method: "POST",
        body: JSON.stringify(payload),
        timeoutMs: 120000,
      });
      if (!result.ok || result.networkError) {
        window.alert(
          `[Mídias] Falha no upload de "${file.name}": ${result.networkError?.message || result.json?.error || "erro desconhecido"}`,
        );
        return false;
      }
      return true;
    }

    function clearMidiasExplorerOnLogout() {
      midiasRevokeAllBlobs();
      closeMidiasPreview();
      midiasFolders = [];
      midiasFiles = [];
      midiasPastaUploadRaizId = null;
      currentMidiasFolderId = null;
      const grid = $("midiasGrid");
      const bc = $("midiasBreadcrumb");
      if (grid) grid.innerHTML = "";
      if (bc) bc.innerHTML = "";
      const empty = $("midiasEmpty");
      const panel = $("midiasNovaPastaPanel");
      if (empty) empty.hidden = true;
      if (panel) panel.hidden = true;
      midiasDnDPayload = null;
      const nome = $("midiasNovaPastaNome");
      if (nome) nome.value = "";
      $("btnMidiasNovaPasta")?.classList.remove("is-open");
    }

    function bindMidiasDropPastaNaRaiz(el) {
      if (!podeOrganizarMidias()) return;
      el.classList.add("midias-bc--drop-target");
      el.addEventListener("dragover", (ev) => {
        const src = midiasDnDPayload;
        if (!src || src.kind !== "folder") return;
        const moved = midiasFolders.find((x) => x.id === src.id);
        if (!moved || moved.parentId === null) return;
        ev.preventDefault();
        ev.dataTransfer.dropEffect = "move";
        el.classList.add("midias-bc--drop-hover");
      });
      el.addEventListener("dragleave", () => {
        el.classList.remove("midias-bc--drop-hover");
      });
      el.addEventListener("drop", async (ev) => {
        el.classList.remove("midias-bc--drop-hover");
        ev.preventDefault();
        const payload = midiasDnDPayload || parseMidiasDnD(ev);
        if (!payload || payload.kind !== "folder") return;
        const moved = midiasFolders.find((x) => x.id === payload.id);
        if (!moved || moved.parentId === null) return;
        const result = await midiasApiMoverPasta(payload.id, null);
        if (!result.ok || result.networkError) {
          const msg =
            result.networkError?.message ||
            (typeof result.json?.error === "string"
              ? result.json.error
              : "Não foi possível mover a pasta.");
          window.alert(msg);
          return;
        }
        midiasDnDPayload = null;
        await loadMidiasData();
      });
    }

    function renderMidiasBreadcrumb() {
      const nav = $("midiasBreadcrumb");
      if (!nav) return;
      nav.innerHTML = "";
      const parts = [{ id: null, label: "Início" }];
      if (currentMidiasFolderId) {
        const chain = [];
        let id = currentMidiasFolderId;
        while (id) {
          const f = midiasFolders.find((x) => x.id === id);
          if (!f) break;
          chain.unshift({ id: f.id, label: f.name });
          id = f.parentId;
        }
        parts.push(...chain);
      }
      parts.forEach((p, i) => {
        if (i > 0) {
          const sep = document.createElement("span");
          sep.className = "midias-bc-sep";
          sep.setAttribute("aria-hidden", "true");
          sep.innerHTML =
            '<svg class="midias-bc-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M9 18l6-6-6-6"/></svg>';
          nav.appendChild(sep);
        }
        const isLast = i === parts.length - 1;
        if (isLast) {
          const cur = document.createElement("span");
          cur.className = "midias-bc-current";
          cur.textContent = p.label;
          cur.setAttribute("aria-current", "page");
          nav.appendChild(cur);
          if (p.id === null) bindMidiasDropPastaNaRaiz(cur);
        } else {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "midias-bc-seg";
          btn.textContent = p.label;
          btn.addEventListener("click", () => {
            currentMidiasFolderId = p.id;
            renderMidiasExplorer();
          });
          if (p.id === null) bindMidiasDropPastaNaRaiz(btn);
          nav.appendChild(btn);
        }
      });
    }

    function renderMidiasExplorer() {
      const grid = $("midiasGrid");
      const empty = $("midiasEmpty");
      if (!grid || !empty) return;
      grid.innerHTML = "";
      renderMidiasBreadcrumb();
      aplicarPermissoesMidiasUi();

      const naRaiz = currentMidiasFolderId === null;
      const podeEditar = podeOrganizarMidias();
      let folders = midiasGetChildFolders(currentMidiasFolderId);
      if (naRaiz && midiasPastaUploadRaizId) {
        folders = folders.filter((f) => f.id !== midiasPastaUploadRaizId);
      }
      let files;
      if (naRaiz && midiasPastaUploadRaizId) {
        files = midiasGetFilesIn(midiasPastaUploadRaizId);
      } else {
        files = midiasGetFilesIn(currentMidiasFolderId);
      }
      folders.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
      files.sort((a, b) => a.displayName.localeCompare(b.displayName, "pt-BR"));

      folders.forEach((folder) => {
        const tile = document.createElement("div");
        tile.className = "midias-tile midias-tile--folder";
        tile.innerHTML = `
          <svg class="midias-folder-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
          <div class="midias-tile-name"></div>
        `;
        tile.querySelector(".midias-tile-name").textContent = folder.name;
        if (podeEditar) {
          const ren = document.createElement("button");
          ren.type = "button";
          ren.className = "midias-tile-rename";
          ren.textContent = "✎";
          ren.title = "Renomear pasta";
          ren.setAttribute("aria-label", "Renomear pasta");
          ren.draggable = false;
          ren.addEventListener("click", async (e) => {
            e.stopPropagation();
            await midiasRenomearPasta(folder);
          });
          const del = document.createElement("button");
          del.type = "button";
          del.className = "midias-tile-del";
          del.textContent = "✕";
          del.title = "Remover pasta vazia";
          del.draggable = false;
          del.addEventListener("click", async (e) => {
            e.stopPropagation();
            if (midiasFolderHasContent(folder.id)) {
              window.alert("Esvazie a pasta antes de remover.");
              return;
            }
            const idEmpresa = empresaProfile?.id_empresa;
            if (!idEmpresa) {
              window.alert("Empresa não identificada para remover pasta.");
              return;
            }
            const result = await apiFetch(`/empresas/${idEmpresa}/pastas/${folder.id}`, {
              method: "DELETE",
            });
            if (!result.ok || result.networkError) {
              const msg =
                result.networkError?.message ||
                (typeof result.json?.error === "string"
                  ? result.json.error
                  : "Não foi possível remover a pasta.");
              window.alert(msg);
              return;
            }
            if (currentMidiasFolderId === folder.id) {
              currentMidiasFolderId = folder.parentId;
            }
            await loadMidiasData();
          });
          tile.appendChild(ren);
          tile.appendChild(del);
        }
        tile.addEventListener("click", () => {
          if (tile.dataset.midiasSkipClick === "1") return;
          currentMidiasFolderId = folder.id;
          renderMidiasExplorer();
        });
        attachMidiasDnDSource(tile, { kind: "folder", id: folder.id });
        attachMidiasFolderDropTarget(tile, folder.id);
        grid.appendChild(tile);
      });

      files.forEach((file) => {
        const tile = document.createElement("div");
        tile.className = "midias-tile midias-tile--file";
        const prev = document.createElement("div");
        prev.className =
          "midias-tile-preview" + (file.kind === "video" ? " midias-tile-preview--video" : "");
        if (file.kind === "image" && file.objectUrl) {
          const img = document.createElement("img");
          img.src = file.objectUrl;
          img.alt = "";
          img.draggable = false;
          prev.appendChild(img);
        } else {
          prev.textContent = "🎬";
        }
        const nameEl = document.createElement("div");
        nameEl.className = "midias-tile-name";
        nameEl.textContent = file.displayName;
        tile.appendChild(prev);
        tile.appendChild(nameEl);
        if (podeEditar) {
          const ren = document.createElement("button");
          ren.type = "button";
          ren.className = "midias-tile-rename";
          ren.textContent = "✎";
          ren.title = "Renomear";
          ren.setAttribute("aria-label", "Renomear arquivo");
          ren.draggable = false;
          ren.addEventListener("click", async (e) => {
            e.stopPropagation();
            await midiasRenomearMidia(file);
          });
          const del = document.createElement("button");
          del.type = "button";
          del.className = "midias-tile-del";
          del.textContent = "✕";
          del.title = "Remover";
          del.draggable = false;
          del.addEventListener("click", async (e) => {
            e.stopPropagation();
            const idEmpresa = empresaProfile?.id_empresa;
            if (!idEmpresa) {
              window.alert("Empresa não identificada para remover arquivo.");
              return;
            }
            const result = await apiFetch(`/empresas/${idEmpresa}/midias/${file.id}`, {
              method: "DELETE",
            });
            if (!result.ok || result.networkError) {
              const msg =
                result.networkError?.message ||
                (typeof result.json?.error === "string"
                  ? result.json.error
                  : "Não foi possível remover o arquivo.");
              window.alert(msg);
              return;
            }
            await loadMidiasData();
          });
          tile.appendChild(ren);
          tile.appendChild(del);
        }
        attachMidiasDnDSource(tile, { kind: "file", id: file.id });
        tile.addEventListener("click", () => {
          if (tile.dataset.midiasSkipClick === "1") return;
          openMidiasPreview(file);
        });
        grid.appendChild(tile);
      });

      empty.hidden = folders.length > 0 || files.length > 0;
    }

    function newCtxId() {
      return typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `ctx-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    }

    function getPromocaoFromInputs() {
      return {
        nome: $("promoNome").value.trim(),
        produto: $("promoProduto").value.trim(),
        beneficio: $("promoBeneficio").value.trim(),
        tipo: $("promoTipo").value.trim(),
        detalhe: $("promoDetalhe").value.trim(),
        precoOferta: $("promoPreco").value.trim(),
        validade: $("promoValidade").value.trim(),
        onde: $("promoOnde").value.trim(),
        publico: $("promoPublico").value.trim(),
        cta: $("promoCta").value.trim(),
        restricoes: $("promoRestricoes").value.trim(),
      };
    }

    function clearPromocaoForm() {
      [
        "promoNome",
        "promoProduto",
        "promoBeneficio",
        "promoTipo",
        "promoDetalhe",
        "promoPreco",
        "promoValidade",
        "promoOnde",
        "promoPublico",
        "promoCta",
        "promoRestricoes",
      ].forEach((id) => {
        const el = $(id);
        if (el) el.value = "";
      });
    }

    function getLancamentoFromInputs() {
      return {
        nome: $("lancNome").value.trim(),
        oQue: $("lancOQue").value.trim(),
        problema: $("lancProblema").value.trim(),
        novidades: $("lancNovidades").value.trim(),
        diferencial: $("lancDiferencial").value.trim(),
        publico: $("lancPublico").value.trim(),
        disponibilidade: $("lancDisponibilidade").value.trim(),
        dataMomento: $("lancDataMomento").value.trim(),
        tom: $("lancTom").value.trim(),
        cta: $("lancCta").value.trim(),
        restricoes: $("lancRestricoes").value.trim(),
      };
    }

    function clearLancamentoForm() {
      [
        "lancNome",
        "lancOQue",
        "lancProblema",
        "lancNovidades",
        "lancDiferencial",
        "lancPublico",
        "lancDisponibilidade",
        "lancDataMomento",
        "lancTom",
        "lancCta",
        "lancRestricoes",
      ].forEach((id) => {
        const el = $(id);
        if (el) el.value = "";
      });
    }

    function getDataComemorativaFromInputs() {
      return {
        nome: $("dcNome").value.trim(),
        ocasiao: $("dcOcasiao").value.trim(),
        periodo: $("dcPeriodo").value.trim(),
        mensagem: $("dcMensagem").value.trim(),
        tom: $("dcTom").value.trim(),
        publico: $("dcPublico").value.trim(),
        conexaoMarca: $("dcConexao").value.trim(),
        cta: $("dcCta").value.trim(),
        restricoes: $("dcRestricoes").value.trim(),
      };
    }

    function clearDataComemorativaForm() {
      [
        "dcNome",
        "dcOcasiao",
        "dcPeriodo",
        "dcMensagem",
        "dcTom",
        "dcPublico",
        "dcConexao",
        "dcCta",
        "dcRestricoes",
      ].forEach((id) => {
        const el = $(id);
        if (el) el.value = "";
      });
    }

    function addPersRow() {
      const box = $("persRows");
      if (!box) return;
      const row = document.createElement("div");
      row.className = "ctx-pers-row";
      row.innerHTML = `
        <div class="ctx-pers-row-head">
          <span>Campo</span>
          <button type="button" class="ctx-pers-remove" aria-label="Remover campo">Remover</button>
        </div>
        <label>Nome do campo</label>
        <input type="text" class="pers-nome" autocomplete="off" placeholder="Ex.: Ingredientes em destaque" />
        <label>Valor</label>
        <textarea class="pers-valor ctx-field" rows="2" placeholder="Ex.: blend angus, bacon artesanal"></textarea>
      `;
      row.querySelector(".ctx-pers-remove").addEventListener("click", () => {
        const rows = box.querySelectorAll(".ctx-pers-row");
        if (rows.length <= 1) {
          row.querySelector(".pers-nome").value = "";
          row.querySelector(".pers-valor").value = "";
          return;
        }
        row.remove();
      });
      box.appendChild(row);
    }

    function clearPersonalizadoForm() {
      const t = $("persTitulo");
      if (t) t.value = "";
      const box = $("persRows");
      if (box) {
        box.innerHTML = "";
        addPersRow();
      }
    }

    function getPersonalizadoFromInputs() {
      const titulo = $("persTitulo").value.trim();
      const campos = [];
      $("persRows").querySelectorAll(".ctx-pers-row").forEach((row) => {
        const nome = row.querySelector(".pers-nome")?.value.trim() ?? "";
        const valor = row.querySelector(".pers-valor")?.value.trim() ?? "";
        if (nome || valor) campos.push({ nome, valor });
      });
      return { titulo, campos };
    }

    function resetCtxPickerUi() {
      contextoEmEdicaoId = null;
      $("ctxPicker").classList.remove("open");
      $("ctxPickerChoose").hidden = false;
      $("ctxFormPromocao").hidden = true;
      $("ctxFormLancamento").hidden = true;
      $("ctxFormDataComemorativa").hidden = true;
      $("ctxFormPersonalizado").hidden = true;
      clearPromocaoForm();
      clearLancamentoForm();
      clearDataComemorativaForm();
      clearPersonalizadoForm();
    }

    function makeContextoNome(item) {
      if (!item || !item.tipo) return "Contexto";
      if (item.tipo === "promocao" && item.promocao?.nome) return item.promocao.nome;
      if (item.tipo === "lancamento" && item.lancamento?.nome) return item.lancamento.nome;
      if (item.tipo === "data_comemorativa" && item.dataComemorativa?.nome) return item.dataComemorativa.nome;
      if (item.tipo === "personalizado" && item.personalizado?.titulo) return item.personalizado.titulo;
      return `${CTX_LABEL[item.tipo] || "Contexto"} ${new Date().toLocaleDateString("pt-BR")}`;
    }

    function normalizeContextoFromApi(row) {
      const dados = row?.dados_json && typeof row.dados_json === "object" ? row.dados_json : {};
      const tipoRaw = String(dados?.tipo || row?.schema_json?.tipo || "").trim().toLowerCase();
      const tipo =
        tipoRaw === "promocao" ||
        tipoRaw === "lancamento" ||
        tipoRaw === "data_comemorativa" ||
        tipoRaw === "personalizado"
          ? tipoRaw
          : "personalizado";
      return {
        id: row?.id_contexto_empresa || newCtxId(),
        tipo,
        texto: "",
        promocao: tipo === "promocao" ? (dados.promocao || null) : null,
        lancamento: tipo === "lancamento" ? (dados.lancamento || null) : null,
        dataComemorativa: tipo === "data_comemorativa" ? (dados.dataComemorativa || null) : null,
        personalizado: tipo === "personalizado" ? (dados.personalizado || null) : null,
      };
    }

    function buildContextoPayload(item) {
      const dados = { tipo: item.tipo };
      if (item.tipo === "promocao") dados.promocao = item.promocao || {};
      if (item.tipo === "lancamento") dados.lancamento = item.lancamento || {};
      if (item.tipo === "data_comemorativa") dados.dataComemorativa = item.dataComemorativa || {};
      if (item.tipo === "personalizado") dados.personalizado = item.personalizado || {};
      return {
        tipo: item.tipo,
        nome: makeContextoNome(item),
        descricao: "",
        dados,
      };
    }

    function errorMessageFromResult(result, fallback) {
      if (result?.networkError?.message) return result.networkError.message;
      const err = result?.json?.error;
      if (typeof err === "string" && err.trim()) return err;
      if (err && typeof err === "object") {
        if (typeof err.message === "string" && err.message.trim()) return err.message;
        if (typeof err.details === "string" && err.details.trim()) return err.details;
        try {
          return JSON.stringify(err);
        } catch {
          return fallback;
        }
      }
      return fallback;
    }

    async function loadContextosData() {
      const idEmpresa = empresaProfile?.id_empresa;
      if (!idEmpresa || !session?.access_token) {
        contextosItems = [];
        renderCtxList();
        return;
      }
      const result = await apiFetch(`/empresas/${idEmpresa}/contextos`);
      if (!result.ok || result.networkError) {
        showPre(
          $("outContextos"),
          errorMessageFromResult(result, "Falha ao carregar contextos."),
          "err",
        );
        return;
      }
      contextosItems = Array.isArray(result.json?.contextos)
        ? result.json.contextos.map(normalizeContextoFromApi)
        : [];
      renderCtxList();
    }

    function openCtxEditorForType(tipo) {
      $("ctxPicker").classList.add("open");
      $("ctxPickerChoose").hidden = true;
      $("ctxFormPromocao").hidden = tipo !== "promocao";
      $("ctxFormLancamento").hidden = tipo !== "lancamento";
      $("ctxFormDataComemorativa").hidden = tipo !== "data_comemorativa";
      $("ctxFormPersonalizado").hidden = tipo !== "personalizado";
    }

    function beginCtxEdit(item) {
      if (!item || !item.id || !item.tipo) return;
      contextoEmEdicaoId = item.id;
      openCtxEditorForType(item.tipo);
      if (item.tipo === "promocao") {
        clearPromocaoForm();
        const p = item.promocao || {};
        $("promoNome").value = p.nome || "";
        $("promoProduto").value = p.produto || "";
        $("promoBeneficio").value = p.beneficio || "";
        $("promoTipo").value = p.tipo || "";
        $("promoDetalhe").value = p.detalhe || "";
        $("promoPreco").value = p.precoOferta || "";
        $("promoValidade").value = p.validade || "";
        $("promoOnde").value = p.onde || "";
        $("promoPublico").value = p.publico || "";
        $("promoCta").value = p.cta || "";
        $("promoRestricoes").value = p.restricoes || "";
        $("promoNome")?.focus();
        return;
      }
      if (item.tipo === "lancamento") {
        clearLancamentoForm();
        const l = item.lancamento || {};
        $("lancNome").value = l.nome || "";
        $("lancOQue").value = l.oQue || "";
        $("lancProblema").value = l.problema || "";
        $("lancNovidades").value = l.novidades || "";
        $("lancDiferencial").value = l.diferencial || "";
        $("lancPublico").value = l.publico || "";
        $("lancDisponibilidade").value = l.disponibilidade || "";
        $("lancDataMomento").value = l.dataMomento || "";
        $("lancTom").value = l.tom || "";
        $("lancCta").value = l.cta || "";
        $("lancRestricoes").value = l.restricoes || "";
        $("lancNome")?.focus();
        return;
      }
      if (item.tipo === "data_comemorativa") {
        clearDataComemorativaForm();
        const d = item.dataComemorativa || {};
        $("dcNome").value = d.nome || "";
        $("dcOcasiao").value = d.ocasiao || "";
        $("dcPeriodo").value = d.periodo || "";
        $("dcMensagem").value = d.mensagem || "";
        $("dcTom").value = d.tom || "";
        $("dcPublico").value = d.publico || "";
        $("dcConexao").value = d.conexaoMarca || "";
        $("dcCta").value = d.cta || "";
        $("dcRestricoes").value = d.restricoes || "";
        $("dcNome")?.focus();
        return;
      }
      if (item.tipo === "personalizado") {
        clearPersonalizadoForm();
        const p = item.personalizado || {};
        $("persTitulo").value = p.titulo || "";
        const box = $("persRows");
        if (box) {
          box.innerHTML = "";
          const campos = Array.isArray(p.campos) ? p.campos : [];
          if (campos.length === 0) addPersRow();
          else {
            campos.forEach((c) => {
              addPersRow();
              const rows = box.querySelectorAll(".ctx-pers-row");
              const row = rows[rows.length - 1];
              const nome = row?.querySelector(".pers-nome");
              const valor = row?.querySelector(".pers-valor");
              if (nome) nome.value = c?.nome || "";
              if (valor) valor.value = c?.valor || "";
            });
          }
        }
        $("persTitulo")?.focus();
      }
    }

    async function saveCtxItem(nextItem) {
      const idEmpresa = empresaProfile?.id_empresa;
      if (!idEmpresa || !session?.access_token) {
        showPre($("outContextos"), "Empresa não identificada para salvar contexto.", "err");
        return;
      }
      const payload = buildContextoPayload(nextItem);
      const path = contextoEmEdicaoId
        ? `/empresas/${idEmpresa}/contextos/${contextoEmEdicaoId}`
        : `/empresas/${idEmpresa}/contextos`;
      const method = contextoEmEdicaoId ? "PATCH" : "POST";
      const result = await apiFetch(path, {
        method,
        body: JSON.stringify(payload),
      });
      if (!result.ok || result.networkError) {
        showPre(
          $("outContextos"),
          errorMessageFromResult(result, "Falha ao salvar contexto."),
          "err",
        );
        return;
      }
      await loadContextosData();
      resetCtxPickerUi();
      showPre($("outContextos"), "Contexto salvo no banco.", "ok");
    }

    function promocaoPreviewLine(p) {
      const parts = [p.nome, p.produto, p.beneficio].filter(Boolean);
      return parts.length ? parts.join(" · ") : "(promoção sem resumo)";
    }

    function lancamentoPreviewLine(l) {
      const parts = [l.nome, l.oQue, l.diferencial].filter(Boolean);
      return parts.length ? parts.join(" · ") : "(lançamento sem resumo)";
    }

    function dataComemorativaPreviewLine(d) {
      const parts = [d.nome, d.ocasiao, d.periodo].filter(Boolean);
      return parts.length ? parts.join(" · ") : "(data comemorativa sem resumo)";
    }

    function personalizadoPreviewLine(p) {
      if (p.titulo) return p.titulo;
      if (p.campos?.length) {
        const f = p.campos[0];
        const s = [f.nome, f.valor].filter(Boolean).join(": ");
        return s || `${p.campos.length} campo(s)`;
      }
      return "(personalizado sem resumo)";
    }

    function renderCtxList() {
      const ul = $("ctxLista");
      ul.innerHTML = "";
      contextosItems.forEach((item) => {
        const li = document.createElement("li");
        li.dataset.id = item.id;
        if (item.tipo === "personalizado") li.classList.add("ctx-list-li--custom");
        if (contextoSelecionadoId === item.id) li.classList.add("ctx-list-li--selected");
        const left = document.createElement("div");
        left.className = "ctx-main";
        const meta = document.createElement("div");
        meta.className = "ctx-meta";
        meta.textContent = CTX_LABEL[item.tipo] ?? item.tipo;
        const body = document.createElement("div");
        if (item.tipo === "promocao" && item.promocao) {
          body.textContent = promocaoPreviewLine(item.promocao);
        } else if (item.tipo === "lancamento" && item.lancamento) {
          body.textContent = lancamentoPreviewLine(item.lancamento);
        } else if (item.tipo === "data_comemorativa" && item.dataComemorativa) {
          body.textContent = dataComemorativaPreviewLine(item.dataComemorativa);
        } else if (item.tipo === "personalizado" && item.personalizado) {
          body.textContent = personalizadoPreviewLine(item.personalizado);
        } else {
          body.textContent = item.texto.trim() ? item.texto : "(sem texto)";
        }
        left.appendChild(meta);
        left.appendChild(body);
        left.addEventListener("click", () => selectCtxForRead(item.id));

        const actions = document.createElement("div");
        actions.className = "ctx-actions";
        const edit = document.createElement("button");
        edit.type = "button";
        edit.className = "ctx-edit";
        edit.textContent = "Editar";
        edit.addEventListener("click", (ev) => {
          ev.stopPropagation();
          beginCtxEdit(item);
        });
        const rm = document.createElement("button");
        rm.type = "button";
        rm.className = "ctx-remove";
        rm.textContent = "Remover";
        rm.addEventListener("click", async (ev) => {
          ev.stopPropagation();
          const idEmpresa = empresaProfile?.id_empresa;
          if (!idEmpresa || !session?.access_token) {
            showPre($("outContextos"), "Empresa não identificada para remover contexto.", "err");
            return;
          }
          const result = await apiFetch(`/empresas/${idEmpresa}/contextos/${item.id}`, {
            method: "DELETE",
          });
          if (!result.ok || result.networkError) {
            showPre(
              $("outContextos"),
              errorMessageFromResult(result, "Falha ao remover contexto."),
              "err",
            );
            return;
          }
          if (contextoEmEdicaoId === item.id) contextoEmEdicaoId = null;
          if (contextoSelecionadoId === item.id) contextoSelecionadoId = null;
          await loadContextosData();
          showPre($("outContextos"), "Contexto removido.", "ok");
        });
        actions.appendChild(edit);
        actions.appendChild(rm);
        li.appendChild(left);
        li.appendChild(actions);
        ul.appendChild(li);
      });
      renderCtxDetails();
    }

    function ctxLabelForDisplay(item) {
      return CTX_LABEL[item?.tipo] ?? item?.tipo ?? "Contexto";
    }

    function contextoToDisplayLines(item) {
      if (!item || !item.tipo) return "(sem conteúdo)";
      if (item.tipo === "promocao" && item.promocao) {
        const p = item.promocao;
        return [
          ["Nome", p.nome],
          ["Produto", p.produto],
          ["Benefício", p.beneficio],
          ["Tipo", p.tipo],
          ["Detalhe", p.detalhe],
          ["Preço / oferta", p.precoOferta],
          ["Validade", p.validade],
          ["Onde", p.onde],
          ["Público", p.publico],
          ["CTA", p.cta],
          ["Restrições", p.restricoes],
        ];
      }
      if (item.tipo === "lancamento" && item.lancamento) {
        const l = item.lancamento;
        return [
          ["Nome", l.nome],
          ["O que está sendo lançado", l.oQue],
          ["Problema que resolve", l.problema],
          ["O que há de novo", l.novidades],
          ["Diferencial", l.diferencial],
          ["Público", l.publico],
          ["Disponibilidade", l.disponibilidade],
          ["Data / momento", l.dataMomento],
          ["Tom", l.tom],
          ["CTA", l.cta],
          ["Restrições", l.restricoes],
        ];
      }
      if (item.tipo === "data_comemorativa" && item.dataComemorativa) {
        const d = item.dataComemorativa;
        return [
          ["Nome / tema", d.nome],
          ["Ocasião", d.ocasiao],
          ["Data / período", d.periodo],
          ["Mensagem central", d.mensagem],
          ["Tom", d.tom],
          ["Público", d.publico],
          ["Conexão com a marca", d.conexaoMarca],
          ["CTA", d.cta],
          ["Restrições", d.restricoes],
        ];
      }
      if (item.tipo === "personalizado" && item.personalizado) {
        const p = item.personalizado;
        const lines = [["Nome", p.titulo || "—"]];
        const campos = Array.isArray(p.campos) ? p.campos : [];
        if (campos.length === 0) {
          lines.push(["Campos", "—"]);
          return lines;
        }
        campos.forEach((c, idx) => {
          const nome = String(c?.nome || "").trim() || `Campo ${idx + 1}`;
          const valor = String(c?.valor || "").trim() || "—";
          lines.push([nome, valor]);
        });
        return lines;
      }
      return [["Texto", item.texto || "(sem texto)"]];
    }

    function formatCtxDetailText(item) {
      const lines = contextoToDisplayLines(item);
      return lines
        .map(([label, value]) => `${label}: ${String(value || "").trim() || "—"}`)
        .join("\n");
    }

    function renderCtxDetails() {
      const box = $("ctxDetalheBox");
      const tipo = $("ctxDetalheTipo");
      const texto = $("ctxDetalheTexto");
      const vazio = $("ctxDetalheVazio");
      if (!box || !tipo || !texto || !vazio) return;
      const item = contextosItems.find((x) => x.id === contextoSelecionadoId);
      if (!item) {
        box.hidden = true;
        tipo.textContent = "";
        texto.textContent = "";
        vazio.hidden = false;
        return;
      }
      tipo.textContent = ctxLabelForDisplay(item);
      texto.textContent = formatCtxDetailText(item);
      box.hidden = false;
      vazio.hidden = true;
    }

    function selectCtxForRead(id) {
      if (!id) return;
      contextoSelecionadoId = id;
      renderCtxList();
    }

    function clearContextosUi() {
      contextosItems = [];
      contextoSelecionadoId = null;
      renderCtxList();
      showPre($("outContextos"), "", null);
      resetCtxPickerUi();
    }

    function clearProfileUi() {
      $("displayNome").textContent = "—";
      $("displayEmail").textContent = "—";
      $("displayTel").textContent = "—";
      $("patchNome").value = "";
      $("patchEmail").value = "";
      $("patchTel").value = "";
      $("patchTelClear").checked = false;
      exitContaEditMode();
      setContaMsg("", null);
      clearContextosUi();
      clearMidiasExplorerOnLogout();
    }

    function displayNameForGreeting(u) {
      const nome = typeof u?.nome === "string" ? u.nome.trim() : "";
      if (nome) return nome;
      const email = typeof u?.email === "string" ? u.email.trim() : "";
      if (email) return email.split("@")[0] || email;
      return "visitante";
    }

    async function loadProfile() {
      const result = await apiFetch("/auth/me");
      if (result.ok && result.json?.usuario) {
        const u = result.json.usuario;
        usuarioAtualId = u.id_usuario || null;
        const nome = typeof u.nome === "string" ? u.nome.trim() : "";
        $("navUserName").textContent = displayNameForGreeting(u);
        $("displayNome").textContent = nome || "—";
        $("displayEmail").textContent = u.email || "—";
        const tel = u.telefone;
        const telStr = tel != null && String(tel).trim() !== "" ? String(tel) : "";
        $("displayTel").textContent = telStr ? telStr : "Não informado";
        $("patchNome").value = u.nome || "";
        $("patchEmail").value = u.email || "";
        $("patchTel").value = u.telefone ?? "";
        $("patchTelClear").checked = false;
        setContaMsg("", null);
        await loadEmpresaAtual();
      } else {
        usuarioAtualId = null;
        const st = result.status ?? 0;
        const authRejected =
          session?.access_token &&
          !result.networkError &&
          (st === 401 || st === 403);
        if (authRejected) {
          session = null;
          saveToken(null);
          setUiLogged(false);
          clearProfileUi();
          empresaProfile = null;
          empresaMembros = [];
          meuCargoEmpresa = null;
          empresaEditMode = false;
          renderEmpresaUi();
        } else if (session?.access_token) {
          $("navUserName").textContent = "usuário";
        }
        setContaMsg(
          result.networkError
            ? "Não foi possível carregar seus dados. Verifique a conexão."
            : "Não foi possível carregar seus dados. Tente sair e entrar de novo.",
          "err",
        );
      }
      return result;
    }

    function showPre(el, text, cls) {
      if (!el) return;
      if (!text) {
        el.hidden = true;
        el.className = "feedback";
        el.textContent = "";
        return;
      }
      el.hidden = false;
      el.className = [cls, "feedback"].filter(Boolean).join(" ");
      el.textContent = text;
    }

    function safeJsonForDisplay(path, ok, json) {
      if (!json || typeof json !== "object") return json;
      if (ok && path === "/auth/login" && json.access_token) {
        return {
          ...json,
          access_token: String(json.access_token).slice(0, 24) + "… (truncado)",
          refresh_token: json.refresh_token ? "… (omitido por segurança)" : json.refresh_token,
        };
      }
      return json;
    }

    function buildFeedback(title, method, path, result) {
      const base = getApiBase();
      const baseLabel = base || window.location.origin || "(origem)";
      const fullUrl = `${baseLabel}${path}`;

      const lines = [];
      lines.push(`[${title}]`);
      lines.push(`Requisição: ${method} ${fullUrl}`);

      if (result.networkError) {
        lines.push("");
        lines.push(String(result.networkError.message || result.networkError));
        return lines.join("\n");
      }

      const { status, ok, json } = result;
      lines.push(`Resposta HTTP: ${status} ${ok ? "OK" : "(falhou)"}`);
      lines.push("");

      lines.push("── Corpo (JSON) ──");
      const displayJson = safeJsonForDisplay(path, ok, json);
      lines.push(
        displayJson !== undefined && displayJson !== null
          ? JSON.stringify(displayJson, null, 2)
          : "(vazio)",
      );
      return lines.join("\n");
    }

    function normalizeSenhaClient(s) {
      return typeof s === "string" ? s.normalize("NFC").trim() : s;
    }

    function togglePasswordVisibility(inputId, buttonEl) {
      const input = $(inputId);
      if (!input || !buttonEl) return;
      const show = input.type === "password";
      input.type = show ? "text" : "password";
      buttonEl.textContent = show ? "Ocultar" : "Mostrar";
      buttonEl.setAttribute("aria-pressed", show ? "true" : "false");
    }

    const DEFAULT_FETCH_TIMEOUT_MS = 25000;

    async function apiFetch(path, opts = {}) {
      const timeoutMs =
        typeof opts.timeoutMs === "number" ? opts.timeoutMs : DEFAULT_FETCH_TIMEOUT_MS;
      const skipAuth = opts.skipAuth === true;
      const { skipAuth: _skip, timeoutMs: _tm, headers: hdrIn, ...fetchRest } = opts;
      const base = getApiBase();
      const url = `${base}${path}`;
      const headers = { ...hdrIn };
      if (fetchRest.body && !headers["Content-Type"]) {
        headers["Content-Type"] = "application/json";
      }
      if (session?.access_token && !skipAuth) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }
      const controller = new AbortController();
      const tid = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const r = await fetch(url, {
          ...fetchRest,
          headers,
          signal: controller.signal,
        });
        clearTimeout(tid);
        const text = await r.text();
        let json;
        try {
          json = text ? JSON.parse(text) : null;
        } catch {
          json = { _parseError: "resposta não é JSON", raw: text };
        }
        return { ok: r.ok, status: r.status, json };
      } catch (networkError) {
        clearTimeout(tid);
        const err = networkError;
        if (err?.name === "AbortError") {
          return {
            ok: false,
            status: 0,
            json: null,
            networkError: new Error(
              `Tempo esgotado (${timeoutMs / 1000}s) — sem resposta. Confira se o backend está rodando e se a URL da API está certa.`,
            ),
          };
        }
        return { ok: false, status: 0, json: null, networkError: err };
      }
    }

    $("navLogin").addEventListener("click", () => {
      window.location.href = new URL("site/login.html", window.location.href).href;
    });
    $("navCadastro").addEventListener("click", () => {
      window.location.href = new URL("site/cadastro.html", window.location.href).href;
    });
    $("navPlanos").addEventListener("click", () => showView("planos"));
    $("navEmpresa").addEventListener("click", () => {
      if (!$("navEmpresa").disabled) showView("empresa");
    });
    document.querySelectorAll(".password-toggle").forEach((btn) => {
      btn.addEventListener("click", () => {
        const target = btn.getAttribute("data-toggle-target");
        if (!target) return;
        togglePasswordVisibility(target, btn);
      });
    });
    $("navConfig").addEventListener("click", () => {
      if (!$("navConfig").disabled) showView("config");
    });

    $("navContextos").addEventListener("click", () => {
      if ($("navContextos").disabled) return;
      showView("contextos");
      void loadContextosData();
    });

    $("navMidias").addEventListener("click", async () => {
      if ($("navMidias").disabled) return;
      showView("midias");
      await loadMidiasData();
    });

    $("btnMidiasNovaPasta").addEventListener("click", () => {
      if (!podeOrganizarMidias()) return;
      const panel = $("midiasNovaPastaPanel");
      if (!panel) return;
      setMidiasNovaPastaPanelOpen(panel.hidden);
    });

    $("btnMidiasCancelarPasta").addEventListener("click", () => {
      const nome = $("midiasNovaPastaNome");
      if (nome) nome.value = "";
      setMidiasNovaPastaPanelOpen(false);
    });

    $("btnMidiasCriarPasta").addEventListener("click", async () => {
      const nome = $("midiasNovaPastaNome");
      if (!nome) return;
      const raw = nome.value.trim();
      if (!raw) {
        window.alert("Digite um nome para a pasta.");
        return;
      }
      if (!currentMidiasFolderId && raw.toLowerCase() === "geral") {
        window.alert(
          'O nome "Geral" é reservado para arquivos enviados na tela inicial. Escolha outro nome.',
        );
        return;
      }
      if (midiasFolderExists(currentMidiasFolderId, raw)) {
        window.alert("Já existe uma pasta com esse nome aqui.");
        return;
      }
      const idEmpresa = empresaProfile?.id_empresa;
      if (!idEmpresa) {
        window.alert("Empresa não identificada para criar pasta.");
        return;
      }
      const result = await apiFetch(`/empresas/${idEmpresa}/pastas`, {
        method: "POST",
        body: JSON.stringify({
          nome: raw,
          id_pasta_pai: currentMidiasFolderId,
        }),
      });
      if (!result.ok || result.networkError) {
        const msg =
          result.networkError?.message ||
          (typeof result.json?.error === "string"
            ? result.json.error
            : "Não foi possível criar a pasta.");
        window.alert(msg);
        return;
      }
      nome.value = "";
      setMidiasNovaPastaPanelOpen(false);
      await loadMidiasData();
    });

    $("btnMidiasAdicionarArquivo")?.addEventListener("click", () => {
      if (!podeOrganizarMidias()) return;
      $("midiasFileInput")?.click();
    });

    const midiasBrowseEl = $("midiasBrowse");
    midiasBrowseEl?.addEventListener("dragover", (e) => {
      if (!podeOrganizarMidias()) return;
      if (e.dataTransfer?.types?.includes("Files")) {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
        midiasBrowseEl.classList.add("midias-browse--drop-active");
      }
    });
    midiasBrowseEl?.addEventListener("dragleave", (e) => {
      if (e.relatedTarget && midiasBrowseEl.contains(e.relatedTarget)) return;
      midiasBrowseEl.classList.remove("midias-browse--drop-active");
    });
    midiasBrowseEl?.addEventListener("drop", async (e) => {
      midiasBrowseEl.classList.remove("midias-browse--drop-active");
      if (!podeOrganizarMidias()) return;
      if (!e.dataTransfer?.files?.length) return;
      e.preventDefault();
      e.stopPropagation();
      const files = Array.from(e.dataTransfer.files);
      for (const file of files) {
        await uploadMidiaArquivo(file);
      }
      await loadMidiasData();
    });

    $("midiasFileInput").addEventListener("change", async (ev) => {
      const input = ev.target;
      if (!input.files?.length) return;
      if (!podeOrganizarMidias()) {
        input.value = "";
        return;
      }
      const files = Array.from(input.files);
      for (const file of files) {
        // Upload sequencial evita picos de memória com base64 grande.
        await uploadMidiaArquivo(file);
      }
      input.value = "";
      await loadMidiasData();
    });

    $("midiasPreviewOverlay")?.addEventListener("click", (ev) => {
      if (ev.target === $("midiasPreviewOverlay")) closeMidiasPreview();
    });
    $("btnMidiasPreviewClose")?.addEventListener("click", () => {
      closeMidiasPreview();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      const panel = $("midiasNovaPastaPanel");
      if (panel && !panel.hidden) {
        $("midiasNovaPastaNome").value = "";
        setMidiasNovaPastaPanelOpen(false);
      }
    });

    $("btnCtxAdd").addEventListener("click", () => {
      $("ctxPicker").classList.toggle("open");
      if ($("ctxPicker").classList.contains("open")) {
        $("ctxPickerChoose").hidden = false;
        $("ctxFormPromocao").hidden = true;
        $("ctxFormLancamento").hidden = true;
        $("ctxFormDataComemorativa").hidden = true;
        $("ctxFormPersonalizado").hidden = true;
        clearPromocaoForm();
        clearLancamentoForm();
        clearDataComemorativaForm();
        clearPersonalizadoForm();
      }
    });

    document.addEventListener("click", (ev) => {
      if (!contextoSelecionadoId) return;
      const viewContextos = $("view-contextos");
      if (!viewContextos?.classList.contains("is-active")) return;
      const target = ev.target;
      if (!(target instanceof Element)) return;
      const contextoContainer = $("ctxLista")?.closest(".card");
      if (!contextoContainer) return;
      const eventPath = typeof ev.composedPath === "function" ? ev.composedPath() : [];
      const clicouDentroDoContainer =
        eventPath.includes(contextoContainer) || contextoContainer.contains(target);
      if (clicouDentroDoContainer) return;
      contextoSelecionadoId = null;
      renderCtxList();
    });

    document.querySelectorAll(".ctx-opt").forEach((btn) => {
      btn.addEventListener("click", () => {
        const tipo = btn.getAttribute("data-tipo");
        if (!tipo || !CTX_LABEL[tipo]) return;
        $("ctxPickerChoose").hidden = true;
        $("ctxFormPromocao").hidden = tipo !== "promocao";
        $("ctxFormLancamento").hidden = tipo !== "lancamento";
        $("ctxFormDataComemorativa").hidden = tipo !== "data_comemorativa";
        $("ctxFormPersonalizado").hidden = tipo !== "personalizado";
        if (tipo === "promocao") {
          clearLancamentoForm();
          clearDataComemorativaForm();
          clearPersonalizadoForm();
          return;
        }
        if (tipo === "lancamento") {
          clearPromocaoForm();
          clearDataComemorativaForm();
          clearPersonalizadoForm();
          clearLancamentoForm();
          return;
        }
        if (tipo === "data_comemorativa") {
          clearPromocaoForm();
          clearLancamentoForm();
          clearPersonalizadoForm();
          clearDataComemorativaForm();
          return;
        }
        if (tipo === "personalizado") {
          clearPromocaoForm();
          clearLancamentoForm();
          clearDataComemorativaForm();
          clearPersonalizadoForm();
        }
      });
    });

    $("btnCtxPromoVoltar").addEventListener("click", () => {
      $("ctxFormPromocao").hidden = true;
      $("ctxPickerChoose").hidden = false;
      $("ctxFormLancamento").hidden = true;
      $("ctxFormDataComemorativa").hidden = true;
      $("ctxFormPersonalizado").hidden = true;
      clearPromocaoForm();
      clearLancamentoForm();
      clearDataComemorativaForm();
      clearPersonalizadoForm();
    });

    $("btnCtxLancamentoVoltar").addEventListener("click", () => {
      $("ctxFormLancamento").hidden = true;
      $("ctxPickerChoose").hidden = false;
      clearLancamentoForm();
      clearDataComemorativaForm();
      clearPersonalizadoForm();
    });

    $("btnCtxDataVoltar").addEventListener("click", () => {
      $("ctxFormDataComemorativa").hidden = true;
      $("ctxPickerChoose").hidden = false;
      clearDataComemorativaForm();
      clearPersonalizadoForm();
    });

    $("btnCtxPersVoltar").addEventListener("click", () => {
      $("ctxFormPersonalizado").hidden = true;
      $("ctxPickerChoose").hidden = false;
      clearPersonalizadoForm();
    });

    $("btnPersAddField").addEventListener("click", () => {
      addPersRow();
    });

    $("btnCtxPersAdd").addEventListener("click", async () => {
      const personalizado = getPersonalizadoFromInputs();
      const hasAny =
        personalizado.titulo.length > 0 ||
        personalizado.campos.some((c) => c.nome.length > 0 || c.valor.length > 0);
      if (!hasAny) {
        return;
      }
      await saveCtxItem({
        id: contextoEmEdicaoId || newCtxId(),
        tipo: "personalizado",
        texto: "",
        personalizado,
      });
    });

    $("btnCtxLancamentoAdd").addEventListener("click", async () => {
      const lancamento = getLancamentoFromInputs();
      const hasAny = Object.values(lancamento).some((v) => v.length > 0);
      if (!hasAny) {
        return;
      }
      await saveCtxItem({
        id: contextoEmEdicaoId || newCtxId(),
        tipo: "lancamento",
        texto: "",
        lancamento,
      });
    });

    $("btnCtxDataAdd").addEventListener("click", async () => {
      const dataComemorativa = getDataComemorativaFromInputs();
      const hasAny = Object.values(dataComemorativa).some((v) => v.length > 0);
      if (!hasAny) {
        return;
      }
      await saveCtxItem({
        id: contextoEmEdicaoId || newCtxId(),
        tipo: "data_comemorativa",
        texto: "",
        dataComemorativa,
      });
    });

    $("btnCtxPromoAdd").addEventListener("click", async () => {
      const promocao = getPromocaoFromInputs();
      const hasAny = Object.values(promocao).some((v) => v.length > 0);
      if (!hasAny) {
        return;
      }
      await saveCtxItem({
        id: contextoEmEdicaoId || newCtxId(),
        tipo: "promocao",
        texto: "",
        promocao,
      });
    });

    $("navLogout").addEventListener("click", () => {
      session = null;
      saveToken(null);
      setUiLogged(false);
      empresaProfile = null;
      empresaMembros = [];
      usuarioAtualId = null;
      meuCargoEmpresa = null;
      empresaEditMode = false;
      clearProfileUi();
      renderEmpresaUi();
      try {
        sessionStorage.removeItem(EMPRESA_FORM_OPEN_KEY);
      } catch {
        /* ignore */
      }
      window.location.href = new URL("site/login.html", window.location.href).href;
    });

    $("btnRegister").addEventListener("click", async () => {
      const btn = $("btnRegister");
      const senha = normalizeSenhaClient($("regSenha").value);
      const senhaConfirm = normalizeSenhaClient($("regSenhaConfirm").value);

      if (senha.length < 8) {
        showPre($("outRegister"), "[Cadastro] Senha deve ter no mínimo 8 caracteres.", "err");
        return;
      }
      if (senha !== senhaConfirm) {
        showPre($("outRegister"), "[Cadastro] Senha e confirmação não conferem.", "err");
        return;
      }

      const body = {
        nome: $("regNome").value.trim(),
        email: normalizeEmailClient($("regEmail").value),
        senha,
        telefone: $("regTel").value.trim() || null,
      };
      btn.disabled = true;
      try {
        showPre($("outRegister"), "[Cadastro] Enviando…", "ok");
        const result = await apiFetch("/auth/register", {
          method: "POST",
          body: JSON.stringify(body),
          skipAuth: true,
        });
        showPre(
          $("outRegister"),
          buildFeedback("Cadastro", "POST", "/auth/register", result),
          result.ok ? "ok" : "err",
        );
        if (result.ok && result.json?.email) {
          $("loginEmail").value = result.json.email;
          $("loginSenha").value = normalizeSenhaClient($("regSenha").value);
        }
      } catch (e) {
        showPre(
          $("outRegister"),
          `[Cadastro] Erro inesperado\n${e instanceof Error ? e.message : String(e)}`,
          "err",
        );
      } finally {
        btn.disabled = false;
      }
    });

    $("btnPlanoTeste").addEventListener("click", () => {
      if (!session?.access_token) {
        showPre(
          $("outPlanos"),
          "[Planos] Faça login para ativar o teste gratuito.",
          "err",
        );
        showView("login");
        return;
      }
      if (!empresaCadastroCompleto(empresaProfile)) {
        showPre(
          $("outPlanos"),
          "[Planos] Antes de assinar, preencha o cadastro completo da empresa (menu Empresa).",
          "err",
        );
        showView("empresa");
        return;
      }
      const next = {
        ...empresaProfile,
        plano_codigo: "teste_gratuito",
        plano_status: "trial",
        updated_at: new Date().toISOString(),
      };
      empresaProfile = normalizeEmpresaProfile(next);
      saveEmpresaToStorage(empresaProfile);
      renderEmpresaUi();
      showPre(
        $("outPlanos"),
        `[Planos] Teste gratuito ativado para ${empresaProfile.nome_fantasia}.\nPlano: ${labelPlanoNome(empresaProfile.plano_codigo)} · ${labelPlanoStatus(empresaProfile.plano_status)}`,
        "ok",
      );
      showView("contextos");
    });

    $("btnEmpresaSalvar").addEventListener("click", async () => {
      if (!podeEditarDadosEmpresa()) return;
      const nome_fantasia = $("empNomeFantasia").value.trim();
      const razao_social = $("empRazaoSocial").value.trim();
      const descricao = $("empDescricao").value.trim();
      const cnpj = $("empCnpj").value.trim();
      const instagram_empresa = normalizeInstagram($("empInstagram").value);
      const telefone_principal = $("empTelefone").value.trim();
      const segmento = $("empSegmento").value.trim();
      const email_principal = normalizeEmailClient($("empEmailPrincipal").value);
      const nome_contato_principal = $("empNomeContato").value.trim();

      if (
        !nome_fantasia ||
        !razao_social ||
        !descricao ||
        !cnpj ||
        !instagram_empresa ||
        !telefone_principal ||
        !segmento ||
        !email_principal ||
        !nome_contato_principal
      ) {
        showPre(
          $("outEmpresa"),
          "[Empresa] Preencha todos os campos obrigatórios (incluindo descrição, telefone, segmento, e-mail e contato).",
          "err",
        );
        return;
      }

      if (!session?.access_token) {
        showPre(
          $("outEmpresa"),
          "[Empresa] Faça login novamente para salvar no banco.",
          "err",
        );
        return;
      }

      const btnSalvar = $("btnEmpresaSalvar");
      if (btnSalvar) btnSalvar.disabled = true;
      showPre($("outEmpresa"), "[Empresa] Salvando no banco…", "ok");

      const prev = empresaProfile || {};
      const payload = {
        nome_fantasia,
        razao_social,
        descricao,
        cnpj,
        instagram_empresa,
        telefone_principal,
        segmento,
        email_principal,
        nome_contato_principal,
      };

      try {
        if (prev?.id_empresa) {
          const result = await apiFetch(`/empresas/${prev.id_empresa}`, {
            method: "PATCH",
            body: JSON.stringify(payload),
          });
          if (!result.ok || result.networkError) {
            const msg =
              result.networkError?.message ||
              (typeof result.json?.error === "string"
                ? result.json.error
                : result.json?.error
                  ? JSON.stringify(result.json.error)
                  : "Não foi possível atualizar a empresa no banco.");
            showPre($("outEmpresa"), `[Empresa] ${msg}`, "err");
            return;
          }
          const emp = result.json?.empresa;
          empresaProfile = normalizeEmpresaProfile(
            emp && typeof emp === "object"
              ? emp
              : { ...payload, ...prev, id_empresa: prev.id_empresa },
          );
          if (empresaProfile) {
            empresaProfile.plano_codigo = prev.plano_codigo || empresaProfile.plano_codigo || "nenhum";
            empresaProfile.plano_status = prev.plano_status || empresaProfile.plano_status || "sem_plano";
          }
          saveEmpresaToStorage(empresaProfile);
          await loadEmpresaMembros(empresaProfile?.id_empresa);
          empresaEditMode = false;
          renderEmpresaUi();
          showPre($("outEmpresa"), "[Empresa] Dados salvos no banco.", "ok");
          return;
        }

        const result = await apiFetch("/empresas", {
          method: "POST",
          body: JSON.stringify(payload),
        });

        if (!result.ok || result.networkError) {
          const msg =
            result.networkError?.message ||
            (typeof result.json?.error === "string"
              ? result.json.error
              : result.json?.error
                ? JSON.stringify(result.json.error)
                : "Não foi possível salvar a empresa no banco.");
          showPre($("outEmpresa"), `[Empresa] ${msg}`, "err");
          return;
        }

        const criada = result.json?.empresa;
        empresaProfile = normalizeEmpresaProfile(
          criada && typeof criada === "object" ? criada : payload,
        );
        if (empresaProfile) {
          empresaProfile.plano_codigo = prev.plano_codigo || "nenhum";
          empresaProfile.plano_status = prev.plano_status || "sem_plano";
          empresaProfile.updated_at = new Date().toISOString();
        }
        saveEmpresaToStorage(empresaProfile);
        try {
          sessionStorage.removeItem(EMPRESA_FORM_OPEN_KEY);
        } catch {
          /* ignore */
        }
        await loadEmpresaMembros(empresaProfile?.id_empresa);
        empresaEditMode = false;
        renderEmpresaUi();
        showPre(
          $("outEmpresa"),
          `[Empresa] Cadastro salvo no banco com sucesso.\nEmpresa ativa: ${nome_fantasia}`,
          "ok",
        );
      } finally {
        if (btnSalvar) btnSalvar.disabled = false;
      }
    });

    $("btnEmpresaAdicionar")?.addEventListener("click", () => {
      try {
        sessionStorage.setItem(EMPRESA_FORM_OPEN_KEY, "1");
      } catch {
        /* ignore */
      }
      empresaEditMode = true;
      renderEmpresaUi();
    });

    $("btnEmpresaEditar")?.addEventListener("click", () => {
      if (!podeEditarDadosEmpresa()) return;
      empresaEditMode = true;
      renderEmpresaUi();
      $("empNomeFantasia")?.focus();
    });

    $("btnEmpresaCancelar")?.addEventListener("click", () => {
      empresaEditMode = false;
      renderEmpresaUi();
      showPre($("outEmpresa"), "", null);
    });

    $("btnEmpresaConvite")?.addEventListener("click", () => {
      const panel = $("empresaInvitePanel");
      if (!panel) return;
      const open = panel.hidden;
      panel.hidden = !open;
      if (!panel.hidden) $("empConviteCodigo")?.focus();
    });

    $("btnEmpresaConviteContinuar")?.addEventListener("click", async () => {
      const code = ($("empConviteCodigo")?.value || "").trim();
      const hint = $("empresaConviteHint");
      if (!hint) return;
      hint.hidden = false;
      if (!code) {
        hint.textContent = "Informe o código do convite.";
        hint.className = "empresa-invite-hint empresa-invite-hint--err";
        return;
      }
      if (!session?.access_token) {
        hint.textContent = "Faça login novamente para usar o convite.";
        hint.className = "empresa-invite-hint empresa-invite-hint--err";
        return;
      }
      hint.textContent = "Validando convite…";
      hint.className = "empresa-invite-hint empresa-invite-hint--muted";
      const result = await apiFetch("/empresas/convites/resgatar", {
        method: "POST",
        body: JSON.stringify({ codigo: code }),
      });
      if (!result.ok || result.networkError) {
        const msg =
          result.networkError?.message ||
          (typeof result.json?.error === "string"
            ? result.json.error
            : result.json?.error
              ? JSON.stringify(result.json.error)
              : "Não foi possível usar este convite.");
        hint.textContent = msg;
        hint.className = "empresa-invite-hint empresa-invite-hint--err";
        return;
      }
      const j = result.json || {};
      const emp = j.empresa;
      if (emp && typeof emp === "object") {
        empresaProfile = normalizeEmpresaProfile(emp);
        saveEmpresaToStorage(empresaProfile);
        try {
          sessionStorage.removeItem(EMPRESA_FORM_OPEN_KEY);
        } catch {
          /* ignore */
        }
        await loadEmpresaMembros(empresaProfile?.id_empresa);
        empresaEditMode = false;
        showPre($("outEmpresa"), j.mensagem || "[Empresa] Vínculo atualizado.", "ok");
        renderEmpresaUi();
      }
      hint.textContent =
        j.mensagem ||
        (j.ja_membro ? "Você já estava nesta empresa." : "Convite aceito.");
      hint.className = "empresa-invite-hint empresa-invite-hint--ok";
    });

    $("btnEmpresaCriarConvite")?.addEventListener("click", async () => {
      const btnCopy = $("btnEmpresaCopiarConvite");
      const btn = $("btnEmpresaCriarConvite");
      const inputCodigo = $("empCodigoCompartilhar");
      const cargoSelect = $("empConviteCargo");
      const idEmpresa = empresaProfile?.id_empresa;
      if (!idEmpresa) {
        window.alert("Empresa não identificada para criar convite.");
        return;
      }
      const cargo = String(cargoSelect?.value || "membro");
      const expiraEmDias = 7;
      if (btn) btn.disabled = true;
      if (btnCopy) btnCopy.disabled = true;
      if (inputCodigo) inputCodigo.value = "";
      try {
        const payload = {
          expira_em_dias: expiraEmDias,
          email_destino: null,
          cargo,
        };
        const result = await apiFetch(`/empresas/${idEmpresa}/convites`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
        if (!result.ok || result.networkError) {
          const msg =
            result.networkError?.message ||
            (typeof result.json?.error === "string"
              ? result.json.error
              : result.json?.error
                ? JSON.stringify(result.json.error)
                : "Não foi possível criar convite.");
          window.alert(msg);
          return;
        }
        const convite = result.json?.convite || {};
        const codigo = String(convite.codigo || "").trim();
        if (!codigo) {
          window.alert("Convite criado, mas sem código retornado.");
          return;
        }
        if (btnCopy) {
          btnCopy.disabled = false;
          btnCopy.dataset.codigo = codigo;
        }
        if (inputCodigo) inputCodigo.value = codigo;
      } finally {
        if (btn) btn.disabled = false;
      }
    });

    $("btnEmpresaCopiarConvite")?.addEventListener("click", async () => {
      const btn = $("btnEmpresaCopiarConvite");
      const codigo = btn?.dataset?.codigo || "";
      if (!codigo) {
        window.alert("Gere um convite antes de copiar.");
        return;
      }
      const ok = await copyTextToClipboard(codigo);
      if (!ok) {
        window.alert(`Não foi possível copiar automaticamente.\nCódigo: ${codigo}`);
        return;
      }
    });

    async function togglePainelGerarConvite() {
      if (!podeGerenciarMembros()) return;
      const drop = $("empresaConviteDropdown");
      const overlay = $("empresaConviteOverlay");
      if (!drop || !overlay) return;
      if (!drop.hidden) {
        drop.hidden = true;
        overlay.hidden = true;
        return;
      }
      drop.hidden = false;
      overlay.hidden = false;
      const btnGerar = $("btnEmpresaCriarConvite");
      if (!btnGerar || btnGerar.disabled) return;
      await btnGerar.click();
    }

    $("btnEmpresaConviteUsuarios")?.addEventListener("click", togglePainelGerarConvite);

    $("empresaConviteOverlay")?.addEventListener("click", () => {
      const drop = $("empresaConviteDropdown");
      const overlay = $("empresaConviteOverlay");
      if (drop) drop.hidden = true;
      if (overlay) overlay.hidden = true;
    });

    $("btnEmpresaFecharConvite")?.addEventListener("click", () => {
      const drop = $("empresaConviteDropdown");
      const overlay = $("empresaConviteOverlay");
      if (drop) drop.hidden = true;
      if (overlay) overlay.hidden = true;
    });

    $("btnLogin").addEventListener("click", async () => {
      const btn = $("btnLogin");
      const email = normalizeEmailClient($("loginEmail").value);
      const senha = normalizeSenhaClient($("loginSenha").value);
      $("loginEmail").value = email;
      btn.disabled = true;
      try {
        showPre($("outLogin"), `[Login] ${email} · ${senha.length} chars\nEnviando…`, "ok");
        const result = await apiFetch("/auth/login", {
          method: "POST",
          body: JSON.stringify({ email, senha }),
          skipAuth: true,
        });
        if (!result.ok || result.networkError) {
          showPre($("outLogin"), buildFeedback("Login", "POST", "/auth/login", result), "err");
          session = null;
          saveToken(null);
          setUiLogged(false);
          return;
        }
        const token = result.json?.access_token;
        if (!token) {
          showPre(
            $("outLogin"),
            buildFeedback("Login", "POST", "/auth/login", {
              ...result,
              ok: false,
              json: { ...result.json, _aviso: "Resposta 200 mas sem access_token" },
            }),
            "err",
          );
          session = null;
          saveToken(null);
          setUiLogged(false);
          return;
        }
        session = { access_token: token };
        saveToken(token);
        showPre($("outLogin"), buildFeedback("Login", "POST", "/auth/login", result), "ok");
        const prof = await loadProfile();
        if (prof.ok && prof.json?.usuario) {
          setUiLogged(true);
          showView("config");
        } else {
          session = null;
          saveToken(null);
          setUiLogged(false);
          showView("login");
        }
      } catch (e) {
        showPre(
          $("outLogin"),
          `[Login] Erro inesperado\n${e instanceof Error ? e.message : String(e)}`,
          "err",
        );
        session = null;
        saveToken(null);
        setUiLogged(false);
      } finally {
        btn.disabled = false;
      }
    });

    $("btnContaEditar").addEventListener("click", () => {
      enterContaEditMode();
    });

    $("btnContaCancelar").addEventListener("click", async () => {
      exitContaEditMode();
      await loadProfile();
    });

    $("btnContaSalvar").addEventListener("click", async () => {
      const body = {};
      const nome = $("patchNome").value.trim();
      const email = $("patchEmail").value.trim();
      const telClear = $("patchTelClear").checked;
      const tel = $("patchTel").value.trim();

      if (nome) body.nome = nome;
      if (email) body.email = normalizeEmailClient(email);
      if (telClear) body.telefone = null;
      else if (tel) body.telefone = tel;

      if (Object.keys(body).length === 0) {
        setContaMsg("Altere ao menos um dado ou marque remover telefone.", "err");
        return;
      }

      const result = await apiFetch("/auth/me", {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      if (result.ok) {
        exitContaEditMode();
        await loadProfile();
        setContaMsg("Alterações salvas.", "ok");
      } else {
        let detail = "Não foi possível salvar. Tente de novo.";
        if (result.networkError) {
          detail = String(result.networkError.message || result.networkError);
        } else if (result.json && typeof result.json === "object" && result.json.error != null) {
          const e = result.json.error;
          detail = typeof e === "string" ? e : JSON.stringify(e);
        }
        setContaMsg(detail, "err");
      }
    });

    function applyEntryHashView() {
      const h = (location.hash || "").replace(/^#/, "");
      if (h === "cadastro") {
        location.replace(new URL("site/cadastro.html", location.href));
        return;
      }
      if (h === "login") {
        location.replace(new URL("site/login.html", location.href));
        return;
      }
      if (h === "") {
        location.replace(new URL("site/login.html", location.href));
        return;
      }
      if (h === "planos") {
        showView("planos");
        setTopNavActive("planos");
        return;
      }
      showView("login");
      setTopNavActive("login");
    }

    (function restoreSession() {
      clearLegacyEmpresaStorage();
      empresaProfile = null;
      renderEmpresaUi();
      const t = loadTokenFromStorage();
      if (!t) {
        session = null;
        setUiLogged(false);
        applyEntryHashView();
        return;
      }
      session = { access_token: t };
      setUiLogged(false);
      void (async () => {
        const result = await loadProfile();
        if (result.ok && result.json?.usuario) {
          setUiLogged(true);
          showView("config");
          return;
        }
        session = null;
        saveToken(null);
        usuarioAtualId = null;
        meuCargoEmpresa = null;
        empresaProfile = null;
        empresaMembros = [];
        empresaEditMode = false;
        clearProfileUi();
        renderEmpresaUi();
        setUiLogged(false);
        setContaMsg("", null);
        applyEntryHashView();
      })();
    })();

    window.addEventListener("hashchange", () => {
      if (loadTokenFromStorage()) return;
      applyEntryHashView();
    });