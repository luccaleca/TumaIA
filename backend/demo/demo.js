    const API_BASE_OVERRIDE = "";

    const LS_API = "tuma_demo_api_base";
    const TOKEN_KEY = "tuma_demo_access_token";
    const EMPRESA_KEY = "tuma_demo_empresa_profile";
    /** Quando o usuário escolhe «Cadastrar minha empresa» sem ter perfil salvo ainda. */
    const EMPRESA_FORM_OPEN_KEY = "tuma_demo_empresa_abrir_form";

    const $ = (id) => document.getElementById(id);

    function getApiBase() {
      if (API_BASE_OVERRIDE) return String(API_BASE_OVERRIDE).replace(/\/$/, "");
      const ls = localStorage.getItem(LS_API);
      if (ls) return ls.replace(/\/$/, "");
      if (typeof location !== "undefined" && location.origin && location.origin !== "null") {
        return location.origin.replace(/\/$/, "");
      }
      return "http://localhost:4000";
    }

    function normalizeEmailClient(s) {
      return typeof s === "string" ? s.trim().toLowerCase() : s;
    }

    let session = null;
    let empresaProfile = null;

    function loadTokenFromStorage() {
      try {
        return sessionStorage.getItem(TOKEN_KEY);
      } catch {
        return null;
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
      try {
        const raw = localStorage.getItem(EMPRESA_KEY);
        if (!raw) return null;
        const obj = JSON.parse(raw);
        return normalizeEmpresaProfile(obj);
      } catch {
        return null;
      }
    }

    function saveEmpresaToStorage(obj) {
      try {
        if (obj) localStorage.setItem(EMPRESA_KEY, JSON.stringify(obj));
        else localStorage.removeItem(EMPRESA_KEY);
      } catch {
        /* ignore */
      }
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
      if (emptyEl) emptyEl.hidden = !showEmpty;
      if (formEl) formEl.hidden = showEmpty;

      if (showEmpty) {
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

    let midiasFolders = [];
    let midiasFiles = [];
    let currentMidiasFolderId = null;

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
        if (f.objectUrl) URL.revokeObjectURL(f.objectUrl);
      });
    }

    function clearMidiasExplorerOnLogout() {
      midiasRevokeAllBlobs();
      midiasFolders = [];
      midiasFiles = [];
      currentMidiasFolderId = null;
      const grid = $("midiasGrid");
      const bc = $("midiasBreadcrumb");
      if (grid) grid.innerHTML = "";
      if (bc) bc.innerHTML = "";
      const empty = $("midiasEmpty");
      const panel = $("midiasNovaPastaPanel");
      if (empty) empty.hidden = true;
      if (panel) panel.hidden = true;
      const nome = $("midiasNovaPastaNome");
      if (nome) nome.value = "";
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
          sep.className = "sep";
          sep.textContent = "›";
          nav.appendChild(sep);
        }
        const btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = p.label;
        btn.addEventListener("click", () => {
          currentMidiasFolderId = p.id;
          renderMidiasExplorer();
        });
        nav.appendChild(btn);
      });
    }

    function renderMidiasExplorer() {
      const grid = $("midiasGrid");
      const empty = $("midiasEmpty");
      const btnUp = $("btnMidiasSubir");
      if (!grid || !empty) return;
      grid.innerHTML = "";
      renderMidiasBreadcrumb();
      if (btnUp) btnUp.hidden = currentMidiasFolderId === null;

      const folders = midiasGetChildFolders(currentMidiasFolderId);
      const files = midiasGetFilesIn(currentMidiasFolderId);
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
        const del = document.createElement("button");
        del.type = "button";
        del.className = "midias-tile-del";
        del.textContent = "✕";
        del.title = "Remover pasta vazia";
        del.addEventListener("click", (e) => {
          e.stopPropagation();
          if (midiasFolderHasContent(folder.id)) {
            window.alert("Esvazie a pasta antes de remover.");
            return;
          }
          if (currentMidiasFolderId === folder.id) {
            currentMidiasFolderId = folder.parentId;
          }
          midiasFolders = midiasFolders.filter((x) => x.id !== folder.id);
          renderMidiasExplorer();
        });
        tile.addEventListener("click", () => {
          currentMidiasFolderId = folder.id;
          renderMidiasExplorer();
        });
        tile.appendChild(del);
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
          prev.appendChild(img);
        } else {
          prev.textContent = "🎬";
        }
        const nameEl = document.createElement("div");
        nameEl.className = "midias-tile-name";
        nameEl.textContent = file.displayName;
        const del = document.createElement("button");
        del.type = "button";
        del.className = "midias-tile-del";
        del.textContent = "✕";
        del.title = "Remover";
        del.addEventListener("click", (e) => {
          e.stopPropagation();
          if (file.objectUrl) URL.revokeObjectURL(file.objectUrl);
          midiasFiles = midiasFiles.filter((x) => x.id !== file.id);
          renderMidiasExplorer();
        });
        tile.appendChild(prev);
        tile.appendChild(nameEl);
        tile.appendChild(del);
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
        const left = document.createElement("div");
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
        const rm = document.createElement("button");
        rm.type = "button";
        rm.className = "ctx-remove";
        rm.textContent = "Remover";
        rm.addEventListener("click", () => {
          contextosItems = contextosItems.filter((x) => x.id !== item.id);
          renderCtxList();
        });
        li.appendChild(left);
        li.appendChild(rm);
        ul.appendChild(li);
      });
    }

    function clearContextosUi() {
      contextosItems = [];
      renderCtxList();
      $("ctxTexto").value = "";
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
      } else {
        if (session?.access_token) {
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
      if (!$("navContextos").disabled) showView("contextos");
    });

    $("navMidias").addEventListener("click", () => {
      if (!$("navMidias").disabled) showView("midias");
    });

    $("btnMidiasSubir").addEventListener("click", () => {
      if (!currentMidiasFolderId) return;
      const cur = midiasFolders.find((x) => x.id === currentMidiasFolderId);
      currentMidiasFolderId = cur ? cur.parentId : null;
      renderMidiasExplorer();
    });

    $("btnMidiasNovaPasta").addEventListener("click", () => {
      const panel = $("midiasNovaPastaPanel");
      const nome = $("midiasNovaPastaNome");
      if (!panel || !nome) return;
      const open = panel.hidden;
      panel.hidden = !open;
      if (!panel.hidden) {
        nome.value = "";
        nome.focus();
      }
    });

    $("btnMidiasCancelarPasta").addEventListener("click", () => {
      const panel = $("midiasNovaPastaPanel");
      const nome = $("midiasNovaPastaNome");
      if (panel) panel.hidden = true;
      if (nome) nome.value = "";
    });

    $("btnMidiasCriarPasta").addEventListener("click", () => {
      const nome = $("midiasNovaPastaNome");
      const panel = $("midiasNovaPastaPanel");
      if (!nome || !panel) return;
      const raw = nome.value.trim();
      if (!raw) {
        window.alert("Digite um nome para a pasta.");
        return;
      }
      if (midiasFolderExists(currentMidiasFolderId, raw)) {
        window.alert("Já existe uma pasta com esse nome aqui.");
        return;
      }
      midiasFolders.push({
        id: newMidiasId("pasta"),
        parentId: currentMidiasFolderId,
        name: raw,
      });
      nome.value = "";
      panel.hidden = true;
      renderMidiasExplorer();
    });

    $("btnMidiasEnviar").addEventListener("click", () => {
      $("midiasFileInput")?.click();
    });

    $("midiasFileInput").addEventListener("change", (ev) => {
      const input = ev.target;
      if (!input.files?.length) return;
      for (const file of input.files) {
        const isVid = file.type.startsWith("video/");
        const url = URL.createObjectURL(file);
        midiasFiles.push({
          id: newMidiasId("arq"),
          folderId: currentMidiasFolderId,
          displayName: stripFileBaseName(file.name),
          objectUrl: url,
          kind: isVid ? "video" : "image",
          fileName: file.name,
        });
      }
      input.value = "";
      renderMidiasExplorer();
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

    $("btnCtxPersAdd").addEventListener("click", () => {
      const personalizado = getPersonalizadoFromInputs();
      const hasAny =
        personalizado.titulo.length > 0 ||
        personalizado.campos.some((c) => c.nome.length > 0 || c.valor.length > 0);
      if (!hasAny) {
        return;
      }
      contextosItems.push({
        id: newCtxId(),
        tipo: "personalizado",
        texto: "",
        personalizado,
      });
      renderCtxList();
      resetCtxPickerUi();
    });

    $("btnCtxLancamentoAdd").addEventListener("click", () => {
      const lancamento = getLancamentoFromInputs();
      const hasAny = Object.values(lancamento).some((v) => v.length > 0);
      if (!hasAny) {
        return;
      }
      contextosItems.push({
        id: newCtxId(),
        tipo: "lancamento",
        texto: "",
        lancamento,
      });
      renderCtxList();
      resetCtxPickerUi();
    });

    $("btnCtxDataAdd").addEventListener("click", () => {
      const dataComemorativa = getDataComemorativaFromInputs();
      const hasAny = Object.values(dataComemorativa).some((v) => v.length > 0);
      if (!hasAny) {
        return;
      }
      contextosItems.push({
        id: newCtxId(),
        tipo: "data_comemorativa",
        texto: "",
        dataComemorativa,
      });
      renderCtxList();
      resetCtxPickerUi();
    });

    $("btnCtxPromoAdd").addEventListener("click", () => {
      const promocao = getPromocaoFromInputs();
      const hasAny = Object.values(promocao).some((v) => v.length > 0);
      if (!hasAny) {
        return;
      }
      contextosItems.push({
        id: newCtxId(),
        tipo: "promocao",
        texto: "",
        promocao,
      });
      renderCtxList();
      resetCtxPickerUi();
    });

    $("navLogout").addEventListener("click", () => {
      session = null;
      saveToken(null);
      setUiLogged(false);
      clearProfileUi();
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

    $("btnEmpresaSalvar").addEventListener("click", () => {
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

      const prev = empresaProfile || {};
      empresaProfile = normalizeEmpresaProfile({
        nome_fantasia,
        razao_social,
        descricao,
        cnpj,
        instagram_empresa,
        telefone_principal,
        segmento,
        email_principal,
        nome_contato_principal,
        plano_codigo: prev.plano_codigo || "nenhum",
        plano_status: prev.plano_status || "sem_plano",
        updated_at: new Date().toISOString(),
      });
      saveEmpresaToStorage(empresaProfile);
      try {
        sessionStorage.removeItem(EMPRESA_FORM_OPEN_KEY);
      } catch {
        /* ignore */
      }
      renderEmpresaUi();
      showPre(
        $("outEmpresa"),
        `[Empresa] Cadastro salvo com sucesso.\nEmpresa ativa: ${nome_fantasia}`,
        "ok",
      );
    });

    $("btnEmpresaAdicionar")?.addEventListener("click", () => {
      try {
        sessionStorage.setItem(EMPRESA_FORM_OPEN_KEY, "1");
      } catch {
        /* ignore */
      }
      renderEmpresaUi();
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
        showPre($("outEmpresa"), j.mensagem || "[Empresa] Vínculo atualizado.", "ok");
        renderEmpresaUi();
      }
      hint.textContent =
        j.mensagem ||
        (j.ja_membro ? "Você já estava nesta empresa." : "Convite aceito.");
      hint.className = "empresa-invite-hint empresa-invite-hint--ok";
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
        setUiLogged(true);
        showPre($("outLogin"), buildFeedback("Login", "POST", "/auth/login", result), "ok");
        showView("config");
        await loadProfile();
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
      empresaProfile = loadEmpresaFromStorage();
      renderEmpresaUi();
      const t = loadTokenFromStorage();
      if (t) {
        session = { access_token: t };
        setUiLogged(true);
        showView("config");
        loadProfile();
        return;
      }
      applyEntryHashView();
    })();

    window.addEventListener("hashchange", () => {
      if (loadTokenFromStorage()) return;
      applyEntryHashView();
    });