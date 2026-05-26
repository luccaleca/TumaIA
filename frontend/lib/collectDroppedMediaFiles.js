const MEDIA_EXT = /\.(jpe?g|jfif|png|gif|webp|bmp|svg|heic|heif|tiff?|mp4|webm|mov|m4v|avi|mkv)$/i;

/**
 * @param {File | null | undefined} file
 */
export function isUploadableMediaFile(file) {
  if (!file) return false;
  const t = String(file.type || "").toLowerCase();
  if (t.startsWith("image/") || t.startsWith("video/")) return true;
  return MEDIA_EXT.test(String(file.name || ""));
}

/**
 * @param {File} file
 */
export function guessMediaMimeType(file) {
  const t = String(file?.type || "").trim().toLowerCase();
  if (t && t !== "application/octet-stream") return t;
  const n = String(file?.name || "").toLowerCase();
  if (n.endsWith(".png")) return "image/png";
  if (n.endsWith(".gif")) return "image/gif";
  if (n.endsWith(".webp")) return "image/webp";
  if (n.endsWith(".heic")) return "image/heic";
  if (n.endsWith(".heif")) return "image/heif";
  if (n.endsWith(".svg")) return "image/svg+xml";
  if (/\.(jpe?g|jfif)$/.test(n)) return "image/jpeg";
  if (/\.tiff?$/.test(n)) return "image/tiff";
  if (n.endsWith(".mp4")) return "video/mp4";
  if (n.endsWith(".webm")) return "video/webm";
  if (n.endsWith(".mov")) return "video/quicktime";
  if (n.endsWith(".m4v")) return "video/x-m4v";
  if (n.endsWith(".avi")) return "video/x-msvideo";
  if (n.endsWith(".mkv")) return "video/x-matroska";
  return "application/octet-stream";
}

/**
 * @param {File} file
 */
export function inferTipoMidia(file) {
  const t = guessMediaMimeType(file);
  if (t.startsWith("image/")) return "imagem";
  if (t.startsWith("video/")) return "video";
  return isUploadableMediaFile(file) ? "imagem" : "outro";
}

/**
 * @param {File} file
 * @returns {string[]}
 */
export function folderPathFromRelativeFile(file) {
  const rel = String(file.webkitRelativePath || "");
  if (!rel.includes("/")) return [];
  return rel.split("/").slice(0, -1).filter(Boolean);
}

/**
 * @param {FileSystemEntry | null | undefined} entry
 * @returns {Promise<File>}
 */
function fileFromEntry(entry) {
  return new Promise((resolve, reject) => {
    entry.file(resolve, reject);
  });
}

/**
 * @param {FileSystemDirectoryReader} reader
 * @returns {Promise<FileSystemEntry[]>}
 */
async function readAllDirectoryEntries(reader) {
  const all = [];
  let batch = await new Promise((resolve, reject) => {
    reader.readEntries(resolve, reject);
  });
  while (batch?.length) {
    all.push(...batch);
    batch = await new Promise((resolve, reject) => {
      reader.readEntries(resolve, reject);
    });
  }
  return all;
}

/**
 * @param {FileSystemEntry} entry
 * @param {string[]} pathParts
 * @param {{ file: File, folderPath: string[] }[]} out
 */
async function traverseFileSystemEntry(entry, pathParts, out) {
  if (entry.isFile) {
    const file = await fileFromEntry(entry);
    if (isUploadableMediaFile(file)) {
      out.push({ file, folderPath: [...pathParts] });
    }
    return;
  }
  if (!entry.isDirectory) return;
  const reader = entry.createReader();
  const children = await readAllDirectoryEntries(reader);
  const nextPath = [...pathParts, entry.name];
  for (const child of children) {
    await traverseFileSystemEntry(child, nextPath, out);
  }
}

/**
 * Lê arquivos de um drop (inclui pastas aninhadas via webkitGetAsEntry).
 *
 * @param {DataTransfer | null | undefined} dataTransfer
 * @returns {Promise<{ file: File, folderPath: string[] }[]>}
 */
export async function collectDroppedMediaFiles(dataTransfer) {
  const out = [];
  const items = dataTransfer?.items ? [...dataTransfer.items] : [];
  let usedEntries = false;

  for (const item of items) {
    if (item.kind !== "file") continue;
    const entry = item.webkitGetAsEntry?.() ?? item.getAsEntry?.();
    if (!entry) continue;
    usedEntries = true;
    await traverseFileSystemEntry(entry, [], out);
  }

  if (!usedEntries) {
    for (const file of Array.from(dataTransfer?.files || [])) {
      if (!isUploadableMediaFile(file)) continue;
      out.push({ file, folderPath: folderPathFromRelativeFile(file) });
    }
  }

  return out;
}

/**
 * @param {FileList | File[] | null | undefined} fileList
 * @returns {{ file: File, folderPath: string[] }[]}
 */
export function collectMediaFilesFromFileList(fileList) {
  const out = [];
  for (const file of Array.from(fileList || [])) {
    if (!isUploadableMediaFile(file)) continue;
    out.push({ file, folderPath: folderPathFromRelativeFile(file) });
  }
  return out;
}
