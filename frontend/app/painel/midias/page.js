"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { authApiFetchWithToken, formatAuthError } from "../../../lib/auth";
import Modal from "../../components/Modal";

function toBase64WithoutPrefix(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const full = String(reader.result || "");
      const idx = full.indexOf(",");
      resolve(idx >= 0 ? full.slice(idx + 1) : full);
    };
    reader.onerror = () => reject(new Error("Falha ao ler arquivo."));
    reader.readAsDataURL(file);
  });
}

function getTipoMidia(file) {
  if (file.type.startsWith("image/")) return "imagem";
  if (file.type.startsWith("video/")) return "video";
  return "outro";
}

export default function MidiasPage() {
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [empresaId, setEmpresaId] = useState(null);
  const [pastas, setPastas] = useState([]);
  const [midias, setMidias] = useState([]);
  const [pastaAtual, setPastaAtual] = useState("");
  const [pastaUploadRaiz, setPastaUploadRaiz] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [previewMidia, setPreviewMidia] = useState(null);
  const [msg, setMsg] = useState("");
  const [msgKind, setMsgKind] = useState("ok");
  const [dragging, setDragging] = useState(null);
  const [dropTarget, setDropTarget] = useState("");
  const [canManageMidias, setCanManageMidias] = useState(false);
  const [renameDialog, setRenameDialog] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const fileInputRef = useRef(null);

  const isRoot = !pastaAtual;
  const pastasFilhas = useMemo(() => {
    const parentId = isRoot ? null : pastaAtual;
    return pastas.filter((p) => {
      if ((p.id_pasta_pai || null) !== parentId) return false;
      // Igual demo: pasta reservada da raiz ("Geral") não aparece como tile navegável na raiz.
      if (isRoot && pastaUploadRaiz && p.id_pasta === pastaUploadRaiz) return false;
      return true;
    });
  }, [pastas, pastaAtual, isRoot, pastaUploadRaiz]);
  const midiasDaPastaAtual = useMemo(() => {
    if (isRoot) {
      return midias.filter((m) => {
        if (m.id_pasta == null) return true;
        if (pastaUploadRaiz && m.id_pasta === pastaUploadRaiz) return true;
        return false;
      });
    }
    return midias.filter((m) => {
      if (m.id_pasta === pastaAtual) return true;
      return false;
    });
  }, [midias, pastaAtual, pastaUploadRaiz, isRoot]);
  const pastaAtualObj = useMemo(() => pastas.find((p) => p.id_pasta === pastaAtual) || null, [pastas, pastaAtual]);
  const breadcrumbs = useMemo(() => {
    if (!pastaAtual || !pastas.length) return [];
    const map = new Map(pastas.map((p) => [p.id_pasta, p]));
    const out = [];
    let current = map.get(pastaAtual) || null;
    while (current) {
      out.unshift(current);
      current = current.id_pasta_pai ? map.get(current.id_pasta_pai) || null : null;
    }
    return out;
  }, [pastas, pastaAtual]);

  function isDescendant(candidateParentId, folderId) {
    if (!candidateParentId || !folderId) return false;
    if (candidateParentId === folderId) return true;
    const map = new Map(pastas.map((p) => [p.id_pasta, p]));
    let curr = map.get(candidateParentId) || null;
    while (curr) {
      if (curr.id_pasta_pai === folderId) return true;
      curr = curr.id_pasta_pai ? map.get(curr.id_pasta_pai) || null : null;
    }
    return false;
  }

  async function loadData() {
    setLoading(true);
    const minhas = await authApiFetchWithToken("/empresas/minhas");
    if (!minhas.ok || minhas.networkError) {
      setMsg(minhas.networkError?.message || formatAuthError(minhas.json) || "Falha ao carregar empresa.");
      setMsgKind("err");
      setLoading(false);
      return;
    }
    const primeira = Array.isArray(minhas.json?.empresas) ? minhas.json.empresas[0] : null;
    const idEmp = primeira?.empresa?.id_empresa || null;
    const papel = String(primeira?.papel || "").toLowerCase();
    setCanManageMidias(papel === "administrador" || papel === "editor");
    setEmpresaId(idEmp);
    if (!idEmp) {
      setPastas([]);
      setMidias([]);
      setPastaAtual("");
      setPastaUploadRaiz(null);
      setLoading(false);
      return;
    }

    const [pastasRes, midiasRes] = await Promise.all([
      authApiFetchWithToken(`/empresas/${idEmp}/pastas`),
      authApiFetchWithToken(`/empresas/${idEmp}/midias`),
    ]);

    if (!pastasRes.ok || pastasRes.networkError) {
      setMsg(pastasRes.networkError?.message || formatAuthError(pastasRes.json) || "Falha ao carregar pastas.");
      setMsgKind("err");
      setLoading(false);
      return;
    }
    if (!midiasRes.ok || midiasRes.networkError) {
      setMsg(midiasRes.networkError?.message || formatAuthError(midiasRes.json) || "Falha ao carregar mídias.");
      setMsgKind("err");
      setLoading(false);
      return;
    }

    const listaPastas = Array.isArray(pastasRes.json?.pastas) ? pastasRes.json.pastas : [];
    setPastas(listaPastas);
    setMidias(Array.isArray(midiasRes.json?.midias) ? midiasRes.json.midias : []);
    setPastaUploadRaiz(pastasRes.json?.id_pasta_upload_raiz || null);
    setPastaAtual((curr) => {
      if (curr && listaPastas.some((p) => p.id_pasta === curr)) return curr;
      return "";
    });
    setLoading(false);
  }

  useEffect(() => {
    const tid = setTimeout(() => {
      void loadData();
    }, 0);
    return () => clearTimeout(tid);
  }, []);

  async function onCreateFolder(nameIn) {
    if (!empresaId || !canManageMidias) return;
    const nome = String(nameIn || "").trim();
    if (!nome || !nome.trim()) return;
    const result = await authApiFetchWithToken(`/empresas/${empresaId}/pastas`, {
      method: "POST",
      body: JSON.stringify({
        nome: nome.trim(),
        id_pasta_pai: pastaAtual || null,
      }),
    });
    if (!result.ok || result.networkError) {
      setMsg(result.networkError?.message || formatAuthError(result.json) || "Falha ao criar pasta.");
      setMsgKind("err");
      return;
    }
    setMsg("Pasta criada.");
    setMsgKind("ok");
    setNewFolderName("");
    setNewFolderOpen(false);
    await loadData();
  }

  async function onUploadFiles(event) {
    const files = Array.from(event.target.files || []);
    if (!files.length || !empresaId || !canManageMidias) return;
    setUploading(true);
    try {
      for (const file of files) {
        const base64 = await toBase64WithoutPrefix(file);
        const payload = {
          id_pasta: pastaAtual || pastaUploadRaiz || null,
          nome_arquivo: file.name,
          nome_exibicao: file.name,
          mime_type: file.type || "application/octet-stream",
          tipo_midia: getTipoMidia(file),
          base64_data: base64,
          descricao: null,
          alt_text: null,
        };
        const result = await authApiFetchWithToken(`/empresas/${empresaId}/midias/upload-base64`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
        if (!result.ok || result.networkError) {
          setMsg(result.networkError?.message || formatAuthError(result.json) || `Falha ao enviar ${file.name}.`);
          setMsgKind("err");
          return;
        }
      }
      setMsg("Upload concluído.");
      setMsgKind("ok");
      await loadData();
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  }

  function triggerUploadDialog() {
    fileInputRef.current?.click();
    setMenuOpen(false);
  }

  async function onDeleteMidia(idMidia) {
    if (!empresaId || !canManageMidias) return;
    const result = await authApiFetchWithToken(`/empresas/${empresaId}/midias/${idMidia}`, {
      method: "DELETE",
    });
    if (!result.ok || result.networkError) {
      setMsg(result.networkError?.message || formatAuthError(result.json) || "Falha ao remover mídia.");
      setMsgKind("err");
      return;
    }
    setMsg("Mídia removida.");
    setMsgKind("ok");
    await loadData();
  }

  async function onRenameFolder(folder) {
    if (!empresaId || !folder?.id_pasta || !canManageMidias) return;
    const novoNome = String(renameDialog?.value || "");
    if (!novoNome || novoNome.trim() === folder.nome) return;
    const result = await authApiFetchWithToken(`/empresas/${empresaId}/pastas/${folder.id_pasta}`, {
      method: "PATCH",
      body: JSON.stringify({
        nome: novoNome.trim(),
        id_pasta_pai: folder.id_pasta_pai ?? null,
      }),
    });
    if (!result.ok || result.networkError) {
      setMsg(result.networkError?.message || formatAuthError(result.json) || "Falha ao renomear pasta.");
      setMsgKind("err");
      return;
    }
    await loadData();
  }

  async function onDeleteFolder(folder) {
    if (!empresaId || !folder?.id_pasta || !canManageMidias) return;
    const result = await authApiFetchWithToken(`/empresas/${empresaId}/pastas/${folder.id_pasta}`, {
      method: "DELETE",
    });
    if (!result.ok || result.networkError) {
      setMsg(result.networkError?.message || formatAuthError(result.json) || "Falha ao remover pasta.");
      setMsgKind("err");
      return;
    }
    if (pastaAtual === folder.id_pasta) setPastaAtual(pastaUploadRaiz || "");
    await loadData();
  }

  async function onRenameMidia(midia) {
    if (!empresaId || !midia?.id_midia || !canManageMidias) return;
    const novoNome = String(renameDialog?.value || "");
    if (!novoNome || novoNome.trim() === midia.nome_exibicao) return;
    const result = await authApiFetchWithToken(`/empresas/${empresaId}/midias/${midia.id_midia}`, {
      method: "PATCH",
      body: JSON.stringify({ nome_exibicao: novoNome.trim() }),
    });
    if (!result.ok || result.networkError) {
      setMsg(result.networkError?.message || formatAuthError(result.json) || "Falha ao renomear mídia.");
      setMsgKind("err");
      return;
    }
    await loadData();
  }

  async function moveFolder(folderId, targetParentId) {
    if (!empresaId || !folderId || !canManageMidias) return;
    if (folderId === targetParentId) return;
    if (targetParentId && isDescendant(targetParentId, folderId)) {
      setMsg("Não é possível mover uma pasta para dentro dela mesma.");
      setMsgKind("err");
      return;
    }
    const folder = pastas.find((p) => p.id_pasta === folderId);
    const result = await authApiFetchWithToken(`/empresas/${empresaId}/pastas/${folderId}`, {
      method: "PATCH",
      body: JSON.stringify({
        id_pasta_pai: targetParentId || null,
        nome: folder?.nome,
      }),
    });
    if (!result.ok || result.networkError) {
      setMsg(result.networkError?.message || formatAuthError(result.json) || "Falha ao mover pasta.");
      setMsgKind("err");
      return;
    }
    await loadData();
  }

  async function moveMidia(midiaId, targetFolderId) {
    if (!empresaId || !midiaId || !canManageMidias) return;
    const idPastaDestino = targetFolderId || pastaUploadRaiz || null;
    if (!idPastaDestino) return;
    const result = await authApiFetchWithToken(`/empresas/${empresaId}/midias/${midiaId}`, {
      method: "PATCH",
      body: JSON.stringify({ id_pasta: idPastaDestino }),
    });
    if (!result.ok || result.networkError) {
      setMsg(result.networkError?.message || formatAuthError(result.json) || "Falha ao mover mídia.");
      setMsgKind("err");
      return;
    }
    await loadData();
  }

  async function handleDrop(targetFolderId) {
    if (!dragging) return;
    if (dragging.type === "folder") {
      await moveFolder(dragging.id, targetFolderId || null);
    } else {
      await moveMidia(dragging.id, targetFolderId);
    }
    setDropTarget("");
    setDragging(null);
  }

  function openPreview(midia) {
    if (!midia?.url_arquivo) return;
    setPreviewMidia(midia);
  }

  const previewItems = useMemo(
    () => midiasDaPastaAtual.filter((m) => Boolean(m?.url_arquivo)),
    [midiasDaPastaAtual],
  );
  const previewIndex = useMemo(() => {
    if (!previewMidia?.id_midia) return -1;
    return previewItems.findIndex((m) => m.id_midia === previewMidia.id_midia);
  }, [previewItems, previewMidia]);
  const hasPrev = previewIndex > 0;
  const hasNext = previewIndex >= 0 && previewIndex < previewItems.length - 1;

  const closePreview = useCallback(() => {
    setPreviewMidia(null);
  }, []);

  const previewPrev = useCallback(() => {
    if (!hasPrev) return;
    setPreviewMidia(previewItems[previewIndex - 1]);
  }, [hasPrev, previewItems, previewIndex]);

  const previewNext = useCallback(() => {
    if (!hasNext) return;
    setPreviewMidia(previewItems[previewIndex + 1]);
  }, [hasNext, previewItems, previewIndex]);

  useEffect(() => {
    if (!previewMidia) return;
    function onKeyDown(ev) {
      if (ev.key === "Escape") closePreview();
      if (ev.key === "ArrowLeft") previewPrev();
      if (ev.key === "ArrowRight") previewNext();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [previewMidia, closePreview, previewPrev, previewNext]);

  function openRenameFolderDialog(folder) {
    setRenameDialog({
      type: "folder",
      title: "Renomear pasta",
      value: folder.nome || "",
      item: folder,
    });
  }

  function openRenameMidiaDialog(midia) {
    setRenameDialog({
      type: "midia",
      title: "Renomear mídia",
      value: midia.nome_exibicao || midia.nome_arquivo || "",
      item: midia,
    });
  }

  function openDeleteFolderDialog(folder) {
    setConfirmDialog({
      type: "folder",
      title: "Remover pasta",
      message: `Deseja remover a pasta "${folder.nome}"?`,
      item: folder,
    });
  }

  function openDeleteMidiaDialog(midia) {
    setConfirmDialog({
      type: "midia",
      title: "Remover mídia",
      message: `Deseja remover a mídia "${midia.nome_exibicao || midia.nome_arquivo}"?`,
      item: midia,
    });
  }

  async function submitRenameDialog() {
    if (!renameDialog) return;
    if (renameDialog.type === "folder") {
      await onRenameFolder(renameDialog.item);
    } else {
      await onRenameMidia(renameDialog.item);
    }
    setRenameDialog(null);
  }

  async function submitConfirmDialog() {
    if (!confirmDialog) return;
    if (confirmDialog.type === "folder") {
      await onDeleteFolder(confirmDialog.item);
    } else {
      await onDeleteMidia(confirmDialog.item.id_midia);
    }
    setConfirmDialog(null);
  }

  return (
    <main className="space-y-4">
      <section className="rounded-xl border border-border bg-background p-4 md:p-5">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-lg font-semibold text-foreground">Mídias</h1>
          <div className="relative flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-lg text-foreground hover:bg-muted"
              title="Ações de mídia"
              aria-label="Ações de mídia"
              disabled={!empresaId || !canManageMidias}
            >
              +
            </button>
            {menuOpen ? (
              <div className="absolute right-0 top-10 z-20 w-44 rounded-md border border-border bg-background p-1 shadow-md">
                <button
                  type="button"
                  onClick={() => {
                    setNewFolderOpen(true);
                    setMenuOpen(false);
                  }}
                  className="w-full rounded px-3 py-2 text-left text-sm text-foreground hover:bg-muted"
                >
                  + Nova pasta
                </button>
                <button
                  type="button"
                  onClick={triggerUploadDialog}
                  className="w-full rounded px-3 py-2 text-left text-sm text-foreground hover:bg-muted"
                >
                  + Upload arquivo
                </button>
              </div>
            ) : null}
          </div>
        </div>
        {!empresaId && !loading ? (
          <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Você precisa cadastrar uma empresa antes de usar mídias.
          </p>
        ) : null}
        {!loading && empresaId && !canManageMidias ? (
          <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Seu cargo permite visualizar mídias, mas não criar, editar, mover ou remover.
          </p>
        ) : null}

        <div className="mt-3 rounded-md border border-border bg-background p-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Pasta atual</p>
              <p className="text-sm font-medium text-foreground">{pastaAtualObj?.nome || "Raiz"}</p>
            </div>
            <button
              type="button"
              onClick={triggerUploadDialog}
              disabled={!empresaId || uploading || !canManageMidias}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-lg text-foreground hover:bg-muted disabled:opacity-60"
              title="Upload de arquivo na pasta atual"
              aria-label="Upload de arquivo na pasta atual"
            >
              +
            </button>
          </div>
          {newFolderOpen ? (
            <div className="mt-3 flex gap-2">
              <input
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Nome da nova pasta"
                className="w-full rounded-md border border-border bg-surface-elevated px-3 py-2 text-sm text-foreground"
              />
              <button
                type="button"
                onClick={() => void onCreateFolder(newFolderName)}
                className="rounded-md border border-border px-3 py-2 text-sm text-foreground hover:bg-muted"
              >
                Criar
              </button>
              <button
                type="button"
                onClick={() => {
                  setNewFolderOpen(false);
                  setNewFolderName("");
                }}
                className="rounded-md border border-border px-3 py-2 text-sm text-foreground hover:bg-muted"
              >
                Cancelar
              </button>
            </div>
          ) : null}
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            {isRoot ? (
              <button
                type="button"
                onClick={() => setPastaAtual("")}
                className="rounded-md border border-border bg-background px-2 py-1 text-foreground hover:bg-muted"
              >
                Raiz /
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setPastaAtual("")}
                onDragOver={(e) => {
                  if (!canManageMidias) return;
                  e.preventDefault();
                  setDropTarget("bc-root");
                }}
                onDragLeave={() => {
                  if (!canManageMidias) return;
                  setDropTarget("");
                }}
                onDrop={(e) => {
                  if (!canManageMidias) return;
                  e.preventDefault();
                  void handleDrop(null);
                }}
                className={`rounded-md border border-border bg-background px-2 py-1 text-foreground transition-colors hover:bg-muted ${
                  dropTarget === "bc-root" ? "border-accent/50 bg-accent-muted" : ""
                }`}
              >
                Raiz /
              </button>
            )}
            {breadcrumbs.map((item, idx) => (
              <button
                key={item.id_pasta}
                type="button"
                onClick={() => setPastaAtual(item.id_pasta)}
                onDragOver={(e) => {
                  if (!canManageMidias) return;
                  e.preventDefault();
                  setDropTarget(`bc-${item.id_pasta}`);
                }}
                onDragLeave={() => {
                  if (!canManageMidias) return;
                  setDropTarget("");
                }}
                onDrop={(e) => {
                  if (!canManageMidias) return;
                  e.preventDefault();
                  void handleDrop(item.id_pasta);
                }}
                className={`rounded-md border border-border bg-background px-2 py-1 text-foreground transition-colors hover:bg-muted ${
                  dropTarget === `bc-${item.id_pasta}` ? "border-accent/50 bg-accent-muted" : ""
                }`}
              >
                {item.nome}
                {idx < breadcrumbs.length - 1 ? " /" : ""}
              </button>
            ))}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,video/*"
            onChange={onUploadFiles}
            disabled={!empresaId || uploading || !canManageMidias}
            className="hidden"
          />
          {uploading ? <p className="mt-2 text-sm text-muted-foreground">Enviando arquivos...</p> : null}
        </div>

        <div className="mt-4">
          {loading ? <p className="mt-2 text-sm text-muted-foreground">Carregando...</p> : null}
          {!loading && pastasFilhas.length === 0 && midiasDaPastaAtual.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">Pasta vazia.</p>
          ) : null}
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {pastasFilhas.map((p) => (
              <article
                key={p.id_pasta}
                onDragStart={() => setDragging({ type: "folder", id: p.id_pasta })}
                draggable={canManageMidias}
                onDragEnd={() => {
                  setDragging(null);
                  setDropTarget("");
                }}
                onDragOver={(e) => {
                  if (!canManageMidias) return;
                  e.preventDefault();
                  setDropTarget(`folder-${p.id_pasta}`);
                }}
                onDragLeave={() => {
                  if (!canManageMidias) return;
                  setDropTarget("");
                }}
                onDrop={(e) => {
                  if (!canManageMidias) return;
                  e.preventDefault();
                  void handleDrop(p.id_pasta);
                }}
                className={`rounded-md border bg-background p-3 transition-colors hover:bg-muted ${
                  dropTarget === `folder-${p.id_pasta}` ? "border-accent/50 ring-1 ring-accent/25" : "border-border"
                }`}
              >
                <button
                  type="button"
                  onClick={() => setPastaAtual(p.id_pasta)}
                  className="w-full text-left"
                >
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Pasta</p>
                  <p className="mt-1 flex items-center gap-2 truncate font-medium text-foreground">
                    <span aria-hidden="true" className="text-amber-500">📁</span>
                    <span className="truncate">{p.nome}</span>
                  </p>
                </button>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => openRenameFolderDialog(p)}
                    disabled={!canManageMidias}
                    className="rounded-md border border-border px-2 py-1 text-xs text-foreground hover:bg-muted"
                  >
                    Renomear
                  </button>
                  <button
                    type="button"
                    onClick={() => openDeleteFolderDialog(p)}
                    disabled={!canManageMidias}
                    className="rounded-md border border-red-400/70 px-2 py-1 text-xs font-medium text-red-800 hover:bg-red-100 dark:border-red-500/45 dark:font-normal dark:text-red-300 dark:hover:bg-red-950/45"
                  >
                    Excluir
                  </button>
                </div>
              </article>
            ))}

            {midiasDaPastaAtual.map((m) => (
              <article
                key={m.id_midia}
                onDragStart={() => setDragging({ type: "midia", id: m.id_midia })}
                draggable={canManageMidias}
                onDragEnd={() => setDragging(null)}
                className="justify-self-start rounded-md border border-border bg-background p-3 transition-colors hover:bg-muted"
                style={{ width: "fit-content", minWidth: "170px", maxWidth: "220px" }}
              >
                {m.url_arquivo && m.tipo_midia === "imagem" ? (
                  <button
                    type="button"
                    onClick={() => openPreview(m)}
                    className="group mb-2 block h-20 w-20 overflow-hidden rounded-md border border-border bg-background"
                    title="Abrir visualização detalhada"
                  >
                    <Image
                      src={m.url_arquivo}
                      alt={m.nome_exibicao || m.nome_arquivo || "Imagem"}
                      width={80}
                      height={80}
                      unoptimized
                      className="h-20 w-20 object-cover transition-transform duration-200 group-hover:scale-[1.04]"
                    />
                  </button>
                ) : null}
                {m.url_arquivo && m.tipo_midia === "video" ? (
                  <button
                    type="button"
                    onClick={() => openPreview(m)}
                    className="group mb-2 block h-20 w-20 overflow-hidden rounded-md border border-border bg-background"
                    title="Abrir visualização detalhada"
                  >
                    <video
                      src={m.url_arquivo}
                      className="h-20 w-20 object-cover"
                      muted
                      playsInline
                      preload="metadata"
                    />
                  </button>
                ) : null}
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{m.tipo_midia}</p>
                <p className="mt-1 max-w-[180px] truncate font-medium text-foreground">{m.nome_exibicao || m.nome_arquivo}</p>
                <p className="mt-1 max-w-[180px] truncate text-xs text-muted-foreground">{m.nome_arquivo}</p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => openRenameMidiaDialog(m)}
                    disabled={!canManageMidias}
                    className="rounded-md border border-border px-2 py-1 text-xs text-foreground hover:bg-muted"
                  >
                    Renomear
                  </button>
                  <button
                    type="button"
                    onClick={() => openDeleteMidiaDialog(m)}
                    disabled={!canManageMidias}
                    className="rounded-md border border-red-400/70 px-2 py-1 text-xs font-medium text-red-800 hover:bg-red-100 dark:border-red-500/45 dark:font-normal dark:text-red-300 dark:hover:bg-red-950/45"
                  >
                    Remover
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {previewMidia?.url_arquivo ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={closePreview}
        >
          <section
            className="relative w-full max-w-5xl rounded-xl border border-border bg-background p-4 shadow-xl"
            onClick={(ev) => ev.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-foreground">
                  {previewMidia.nome_exibicao || previewMidia.nome_arquivo}
                </p>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  {previewMidia.tipo_midia}
                  {previewIndex >= 0 ? ` · ${previewIndex + 1}/${previewItems.length}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={closePreview}
                className="rounded-md border border-border px-2 py-1 text-xs text-foreground hover:bg-muted"
              >
                Fechar
              </button>
            </div>

            <div className="relative flex min-h-[55vh] items-center justify-center rounded-lg border border-border bg-black/50 p-2">
              {previewMidia.tipo_midia === "imagem" ? (
                <Image
                  src={previewMidia.url_arquivo}
                  alt={previewMidia.nome_exibicao || previewMidia.nome_arquivo || "Pré-visualização da mídia"}
                  width={1400}
                  height={1000}
                  unoptimized
                  className="max-h-[70vh] w-auto rounded-md"
                />
              ) : previewMidia.tipo_midia === "video" ? (
                <video
                  src={previewMidia.url_arquivo}
                  controls
                  className="max-h-[70vh] w-full rounded-md bg-black"
                />
              ) : (
                <a
                  href={previewMidia.url_arquivo}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex rounded-md border border-border px-3 py-2 text-sm text-foreground hover:bg-muted"
                >
                  Abrir arquivo
                </a>
              )}

              <button
                type="button"
                onClick={previewPrev}
                disabled={!hasPrev}
                className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full border border-border bg-background/85 px-3 py-2 text-sm text-foreground shadow-sm backdrop-blur-sm hover:bg-muted disabled:opacity-30"
                title="Anterior"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={previewNext}
                disabled={!hasNext}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full border border-border bg-background/85 px-3 py-2 text-sm text-foreground shadow-sm backdrop-blur-sm hover:bg-muted disabled:opacity-30"
                title="Próxima"
              >
                ›
              </button>
            </div>
          </section>
        </div>
      ) : null}

      <Modal
        open={Boolean(renameDialog)}
        onClose={() => setRenameDialog(null)}
        title={renameDialog?.title || "Renomear"}
      >
        {renameDialog ? (
          <>
            <input
              value={renameDialog.value}
              onChange={(e) => setRenameDialog((s) => (s ? { ...s, value: e.target.value } : s))}
              className="mt-3 w-full rounded-md border border-border bg-surface-elevated px-3 py-2 text-sm text-foreground"
            />
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => void submitRenameDialog()}
                className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground"
              >
                Salvar
              </button>
              <button
                type="button"
                onClick={() => setRenameDialog(null)}
                className="rounded-md border border-border px-3 py-1.5 text-sm text-foreground hover:bg-muted"
              >
                Cancelar
              </button>
            </div>
          </>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(confirmDialog)}
        onClose={() => setConfirmDialog(null)}
        title={confirmDialog?.title || "Confirmar ação"}
      >
        {confirmDialog ? (
          <>
            <p className="mt-2 text-sm text-foreground">{confirmDialog.message}</p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => void submitConfirmDialog()}
                className="rounded-md border border-red-500/60 bg-red-100 px-3 py-1.5 text-sm font-medium text-red-900 hover:bg-red-200 dark:border-red-500/40 dark:bg-red-950/45 dark:font-normal dark:text-red-100 dark:hover:bg-red-950/65"
              >
                Confirmar
              </button>
              <button
                type="button"
                onClick={() => setConfirmDialog(null)}
                className="rounded-md border border-border px-3 py-1.5 text-sm text-foreground hover:bg-muted"
              >
                Cancelar
              </button>
            </div>
          </>
        ) : null}
      </Modal>

      {msg ? (
        <p
          className={`rounded-lg border px-3 py-2 text-sm ${
            msgKind === "err"
              ? "border-red-200 bg-red-50 text-red-900"
              : "border-accent/40 bg-accent-muted text-foreground dark:border-accent/30"
          }`}
        >
          {msg}
        </p>
      ) : null}
    </main>
  );
}
