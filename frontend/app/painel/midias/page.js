"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { authApiFetchWithToken, formatAuthError } from "../../../lib/auth";
import {
  collectDroppedMediaFiles,
  collectMediaFilesFromFileList,
  guessMediaMimeType,
  inferTipoMidia,
} from "../../../lib/collectDroppedMediaFiles";
import {
  buildMidiasBreadcrumbs,
  isMidiasDesktop,
  midiasPastaIdToUi,
  resolveMidiasPastaAtivaId,
} from "../../../lib/midiasDesktop";
import { resolveEmpresaAtivaId, setEmpresaAtiva, empresaRowFromMinhas, idEmpresaUltimaFromMinhasPayload } from "../../../lib/empresaAtiva";
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
  return inferTipoMidia(file);
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
  const folderInputRef = useRef(null);
  const [uploadZoneHover, setUploadZoneHover] = useState(false);

  const isAtDesktop = isMidiasDesktop(pastaAtual, pastaUploadRaiz);
  const pastaAtivaId = resolveMidiasPastaAtivaId(pastaAtual, pastaUploadRaiz);
  const pastasFilhas = useMemo(() => {
    if (!pastaAtivaId) return [];
    return pastas.filter((p) => (p.id_pasta_pai || null) === pastaAtivaId);
  }, [pastas, pastaAtivaId]);
  const midiasDaPastaAtual = useMemo(() => {
    if (!pastaAtivaId) return [];
    return midias.filter(
      (m) => m.id_pasta === pastaAtivaId || (isAtDesktop && (m.id_pasta == null || m.id_pasta === "")),
    );
  }, [midias, pastaAtivaId, isAtDesktop]);
  const pastaAtualObj = useMemo(
    () => (pastaAtual ? pastas.find((p) => p.id_pasta === pastaAtual) || null : null),
    [pastas, pastaAtual],
  );
  const breadcrumbs = useMemo(
    () => buildMidiasBreadcrumbs(pastas, pastaAtual, pastaUploadRaiz),
    [pastas, pastaAtual, pastaUploadRaiz],
  );
  const pastaAtualLabel = pastaAtualObj?.nome || "Suas mídias";

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
    const list = Array.isArray(minhas.json?.empresas) ? minhas.json.empresas : [];
    const idEmp = resolveEmpresaAtivaId(list, {
      idEmpresaUltimaPerfil: idEmpresaUltimaFromMinhasPayload(minhas.json),
    });
    const rowAtiva = idEmp ? empresaRowFromMinhas(list, idEmp) : null;
    if (rowAtiva?.empresa) setEmpresaAtiva(rowAtiva.empresa);
    const papel = String(rowAtiva?.papel || "").toLowerCase();
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
    const idDesktop = pastasRes.json?.id_pasta_upload_raiz || null;
    setPastaAtual((curr) => {
      if (!curr) return "";
      if (idDesktop && curr === idDesktop) return "";
      if (listaPastas.some((p) => p.id_pasta === curr)) return curr;
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

  useEffect(() => {
    if (typeof window === "undefined" || loading || !midias.length) return;
    const wanted = new URL(window.location.href).searchParams.get("midia")?.trim();
    if (!wanted) return;
    const m = midias.find((x) => x.id_midia === wanted);
    if (!m) return;
    const targetUi = midiasPastaIdToUi(String(m.id_pasta ?? ""), pastaUploadRaiz);
    if (targetUi !== pastaAtual) {
      setPastaAtual(targetUi);
      return;
    }
    requestAnimationFrame(() => {
      document.getElementById(`midia-tile-${wanted}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      if (m.url_arquivo) setPreviewMidia(m);
    });
  }, [loading, midias, pastaAtual, pastaUploadRaiz]);

  async function onCreateFolder(nameIn) {
    if (!empresaId || !canManageMidias || !pastaAtivaId) return;
    const nome = String(nameIn || "").trim();
    if (!nome || !nome.trim()) return;
    const result = await authApiFetchWithToken(`/empresas/${empresaId}/pastas`, {
      method: "POST",
      body: JSON.stringify({
        nome: nome.trim(),
        id_pasta_pai: pastaAtivaId,
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

  async function createPastaForUpload(nome, idPastaPai, workingPastas) {
    const result = await authApiFetchWithToken(`/empresas/${empresaId}/pastas`, {
      method: "POST",
      body: JSON.stringify({
        nome: String(nome || "").trim(),
        id_pasta_pai: idPastaPai || null,
      }),
    });
    if (!result.ok || result.networkError) {
      throw new Error(result.networkError?.message || formatAuthError(result.json) || "Falha ao criar pasta.");
    }
    const pasta = result.json?.pasta;
    if (!pasta?.id_pasta) throw new Error("Resposta inválida ao criar pasta.");
    workingPastas.push(pasta);
    setPastas((prev) => [...prev, pasta]);
    return pasta.id_pasta;
  }

  async function resolvePastaIdForFolderPath(folderPath, baseParentId, cache, workingPastas) {
    let parentId = baseParentId;
    const segments = [];
    for (const seg of folderPath) {
      const nome = String(seg || "").trim();
      if (!nome) continue;
      segments.push(nome);
      const cacheKey = `${parentId || "root"}:${segments.join("/")}`;
      if (cache.has(cacheKey)) {
        parentId = cache.get(cacheKey);
        continue;
      }
      const existing = workingPastas.find(
        (p) => String(p.nome || "").trim() === nome && (p.id_pasta_pai || null) === (parentId || null),
      );
      if (existing?.id_pasta) {
        parentId = existing.id_pasta;
        cache.set(cacheKey, parentId);
        continue;
      }
      const newId = await createPastaForUpload(nome, parentId, workingPastas);
      cache.set(cacheKey, newId);
      parentId = newId;
    }
    return parentId;
  }

  async function uploadOneMediaFile(file, idPasta) {
    const tipoMidia = getTipoMidia(file);
    if (tipoMidia === "outro") {
      throw new Error(`Formato não suportado: ${file.name}`);
    }
    const base64 = await toBase64WithoutPrefix(file);
    const payload = {
      id_pasta: idPasta,
      nome_arquivo: file.name,
      nome_exibicao: file.name,
      mime_type: guessMediaMimeType(file),
      tipo_midia: tipoMidia,
      base64_data: base64,
      descricao: null,
      alt_text: null,
    };
    const result = await authApiFetchWithToken(`/empresas/${empresaId}/midias/upload-base64`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (!result.ok || result.networkError) {
      throw new Error(result.networkError?.message || formatAuthError(result.json) || `Falha ao enviar ${file.name}.`);
    }
  }

  /**
   * @param {{ file: File, folderPath: string[] }[]} entries
   */
  async function uploadMediaEntries(entries) {
    if (!entries.length || !empresaId || !canManageMidias) return;
    if (!pastaAtivaId) return;
    const cache = new Map();
    const workingPastas = [...pastas];
    let openPastaAfterUpload = null;
    setUploading(true);
    try {
      let uploaded = 0;
      for (const { file, folderPath } of entries) {
        const idPasta = folderPath.length
          ? await resolvePastaIdForFolderPath(folderPath, pastaAtivaId, cache, workingPastas)
          : pastaAtivaId;
        await uploadOneMediaFile(file, idPasta);
        if (folderPath.length) openPastaAfterUpload = idPasta;
        uploaded += 1;
      }
      setMsg(`Upload concluído (${uploaded} arquivo${uploaded === 1 ? "" : "s"}).`);
      setMsgKind("ok");
      await loadData();
      if (openPastaAfterUpload) setPastaAtual(midiasPastaIdToUi(openPastaAfterUpload, pastaUploadRaiz));
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Falha no upload.");
      setMsgKind("err");
    } finally {
      setUploading(false);
    }
  }

  async function onUploadFiles(event) {
    const entries = collectMediaFilesFromFileList(event.target.files);
    await uploadMediaEntries(entries);
    event.target.value = "";
  }

  async function onUploadFolder(event) {
    const entries = collectMediaFilesFromFileList(event.target.files);
    await uploadMediaEntries(entries);
    event.target.value = "";
  }

  function onUploadZoneDragEnter(e) {
    if (!empresaId || !canManageMidias || uploading) return;
    const types = [...(e.dataTransfer?.types || [])];
    if (!types.includes("Files")) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    if (e.currentTarget.contains(e.relatedTarget)) return;
    setUploadZoneHover(true);
  }

  function onUploadZoneDragLeave(e) {
    if (e.currentTarget.contains(e.relatedTarget)) return;
    setUploadZoneHover(false);
  }

  function onUploadZoneDragOver(e) {
    if (!empresaId || !canManageMidias || uploading) return;
    const types = [...(e.dataTransfer?.types || [])];
    if (!types.includes("Files")) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }

  async function onUploadZoneDrop(e) {
    if (!empresaId || !canManageMidias || uploading) return;
    setUploadZoneHover(false);
    e.preventDefault();
    const entries = await collectDroppedMediaFiles(e.dataTransfer);
    if (!entries.length) {
      const raw = Array.from(e.dataTransfer?.files || []);
      setMsg(
        raw.length
          ? "Nenhuma imagem ou vídeo encontrado. Use PNG, JPEG, WebP, GIF ou vídeos comuns."
          : "Solte arquivos ou pastas com imagens/vídeos nesta área.",
      );
      setMsgKind("err");
      return;
    }
    await uploadMediaEntries(entries);
  }

  function triggerUploadDialog() {
    fileInputRef.current?.click();
    setMenuOpen(false);
  }

  function triggerUploadFolderDialog() {
    folderInputRef.current?.click();
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

  async function onRenameFolder(folder, novoNomeIn) {
    if (!empresaId || !folder?.id_pasta || !canManageMidias) return false;
    const novoNome = String(novoNomeIn ?? renameDialog?.value ?? "").trim();
    if (!novoNome) {
      setMsg("Informe um nome para a pasta.");
      setMsgKind("err");
      return false;
    }
    if (novoNome === String(folder.nome || "").trim()) {
      setMsg("O nome é igual ao atual.");
      setMsgKind("err");
      return false;
    }
    const result = await authApiFetchWithToken(`/empresas/${empresaId}/pastas/${folder.id_pasta}`, {
      method: "PATCH",
      body: JSON.stringify({
        nome: novoNome,
        id_pasta_pai: folder.id_pasta_pai ?? null,
      }),
    });
    if (!result.ok || result.networkError) {
      setMsg(result.networkError?.message || formatAuthError(result.json) || "Falha ao renomear pasta.");
      setMsgKind("err");
      return false;
    }
    setMsg("Pasta renomeada.");
    setMsgKind("ok");
    await loadData();
    return true;
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
    if (pastaAtual === folder.id_pasta) setPastaAtual("");
    await loadData();
  }

  async function onRenameMidia(midia, novoNomeIn) {
    if (!empresaId || !midia?.id_midia || !canManageMidias) return false;
    const novoNome = String(novoNomeIn ?? renameDialog?.value ?? "").trim();
    const nomeAtual = String(midia.nome_exibicao || midia.nome_arquivo || "").trim();
    if (!novoNome) {
      setMsg("Informe um nome para a mídia.");
      setMsgKind("err");
      return false;
    }
    if (novoNome === nomeAtual) {
      setMsg("O nome é igual ao atual.");
      setMsgKind("err");
      return false;
    }
    const result = await authApiFetchWithToken(`/empresas/${empresaId}/midias/${midia.id_midia}`, {
      method: "PATCH",
      body: JSON.stringify({ nome_exibicao: novoNome }),
    });
    if (!result.ok || result.networkError) {
      setMsg(result.networkError?.message || formatAuthError(result.json) || "Falha ao renomear mídia.");
      setMsgKind("err");
      return false;
    }
    setMsg("Mídia renomeada.");
    setMsgKind("ok");
    await loadData();
    return true;
  }

  async function moveFolder(folderId, targetParentId) {
    if (!empresaId || !folderId || !canManageMidias || !pastaUploadRaiz) return;
    const destParent = targetParentId || pastaUploadRaiz;
    if (folderId === destParent) return;
    if (destParent && isDescendant(destParent, folderId)) {
      setMsg("Não é possível mover uma pasta para dentro dela mesma.");
      setMsgKind("err");
      return;
    }
    const folder = pastas.find((p) => p.id_pasta === folderId);
    const result = await authApiFetchWithToken(`/empresas/${empresaId}/pastas/${folderId}`, {
      method: "PATCH",
      body: JSON.stringify({
        id_pasta_pai: destParent,
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
    if (!empresaId || !midiaId || !canManageMidias || !pastaUploadRaiz) return;
    const idPastaDestino = targetFolderId || pastaUploadRaiz;
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
      await moveFolder(dragging.id, targetFolderId);
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
    const novoNome = String(renameDialog.value || "").trim();
    const ok =
      renameDialog.type === "folder"
        ? await onRenameFolder(renameDialog.item, novoNome)
        : await onRenameMidia(renameDialog.item, novoNome);
    if (ok) setRenameDialog(null);
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
                <button
                  type="button"
                  onClick={triggerUploadFolderDialog}
                  className="w-full rounded px-3 py-2 text-left text-sm text-foreground hover:bg-muted"
                >
                  + Upload pasta
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
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                {isAtDesktop ? "Acervo" : "Pasta"}
              </p>
              <p className="text-sm font-medium text-foreground">{pastaAtualLabel}</p>
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
          {!isAtDesktop ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              <button
                type="button"
                onClick={() => setPastaAtual("")}
                onDragOver={(e) => {
                  if (!canManageMidias) return;
                  e.preventDefault();
                  setDropTarget("bc-desktop");
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
                  dropTarget === "bc-desktop" ? "border-accent/50 bg-accent-muted" : ""
                }`}
              >
                Início
              </button>
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
          ) : null}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,video/*"
            onChange={(e) => void onUploadFiles(e)}
            disabled={!empresaId || uploading || !canManageMidias}
            className="hidden"
          />
          <input
            ref={folderInputRef}
            type="file"
            multiple
            accept="image/*,video/*"
            onChange={(e) => void onUploadFolder(e)}
            disabled={!empresaId || uploading || !canManageMidias}
            className="hidden"
            // @ts-expect-error atributos não tipados no React DOM
            webkitdirectory=""
            directory=""
          />
          {empresaId && canManageMidias ? (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              onDragEnter={onUploadZoneDragEnter}
              onDragLeave={onUploadZoneDragLeave}
              onDragOver={onUploadZoneDragOver}
              onDrop={(e) => void onUploadZoneDrop(e)}
              disabled={uploading}
              className={`mt-3 flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors ${
                uploadZoneHover
                  ? "border-accent bg-accent-muted/60 text-foreground"
                  : "border-border bg-muted/20 text-muted-foreground hover:border-accent/50 hover:bg-muted/40"
              } disabled:cursor-not-allowed disabled:opacity-60`}
            >
              <span className="text-2xl" aria-hidden>
                ⬆
              </span>
              <span className="text-sm font-medium text-foreground">
                Arraste arquivos ou pastas com imagens/vídeos
              </span>
              <span className="text-xs text-muted-foreground">
                Pastas viram subpastas aqui · clique para arquivos ou use + → Upload pasta ({pastaAtualLabel})
              </span>
            </button>
          ) : null}
          {uploading ? <p className="mt-2 text-sm text-muted-foreground">Enviando arquivos...</p> : null}
        </div>

        <div className="mt-4">
          {loading ? <p className="mt-2 text-sm text-muted-foreground">Carregando...</p> : null}
          {!loading && pastasFilhas.length === 0 && midiasDaPastaAtual.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              {isAtDesktop ? "Nenhuma mídia ainda. Arraste arquivos ou pastas acima." : "Pasta vazia."}
            </p>
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
                <div className="mt-2 flex gap-2" onDragStart={(e) => e.preventDefault()}>
                  <button
                    type="button"
                    draggable={false}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      openRenameFolderDialog(p);
                    }}
                    disabled={!canManageMidias}
                    className="rounded-md border border-border px-2 py-1 text-xs text-foreground hover:bg-muted"
                  >
                    Renomear
                  </button>
                  <button
                    type="button"
                    draggable={false}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      openDeleteFolderDialog(p);
                    }}
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
                id={m.id_midia ? `midia-tile-${m.id_midia}` : undefined}
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
                      style={{ width: "auto", height: "auto" }}
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
                <div className="mt-2 flex gap-2" onDragStart={(e) => e.preventDefault()}>
                  <button
                    type="button"
                    draggable={false}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      openRenameMidiaDialog(m);
                    }}
                    disabled={!canManageMidias}
                    className="rounded-md border border-border px-2 py-1 text-xs text-foreground hover:bg-muted"
                  >
                    Renomear
                  </button>
                  <button
                    type="button"
                    draggable={false}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      openDeleteMidiaDialog(m);
                    }}
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
                  style={{ width: "auto", height: "auto" }}
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
          <form
            className="mt-3"
            onSubmit={(e) => {
              e.preventDefault();
              void submitRenameDialog();
            }}
          >
            <input
              value={renameDialog.value}
              onChange={(e) => setRenameDialog((s) => (s ? { ...s, value: e.target.value } : s))}
              autoFocus
              className="w-full rounded-md border border-border bg-surface-elevated px-3 py-2 text-sm text-foreground"
            />
            <div className="mt-3 flex gap-2">
              <button
                type="submit"
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
          </form>
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
