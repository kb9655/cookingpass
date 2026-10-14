import JSZip from "jszip";
import type { JournalPhoto } from "./journalStore";

export function safeDownloadName(value: string, fallback: string): string {
  const cleaned = value
    .replace(/[\\/:*?"<>|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.slice(0, 80) || fallback;
}

export async function saveBlobToDevice(blob: Blob, filename: string): Promise<void> {
  const file = new File([blob], filename, { type: blob.type || "application/octet-stream" });
  const canShareFiles =
    typeof navigator.canShare === "function" && navigator.canShare({ files: [file] });
  if (typeof navigator.share === "function" && canShareFiles) {
    try {
      await navigator.share({ files: [file], title: filename });
      return;
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
    }
  }

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  const isiOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  if (isiOS) {
    window.open(url, "_blank", "noopener");
  }
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export async function saveJournalPhotosZip(photos: JournalPhoto[], zipName: string): Promise<void> {
  const zip = new JSZip();
  photos.forEach((photo, index) => {
    const stamp = new Date(photo.createdAt).toISOString().slice(0, 10);
    zip.file(`${safeDownloadName(photo.title, "photo")}-${stamp}-${index + 1}.jpg`, photo.blob);
  });
  const blob = await zip.generateAsync({ type: "blob" });
  await saveBlobToDevice(blob, zipName.endsWith(".zip") ? zipName : `${zipName}.zip`);
}
