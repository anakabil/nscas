// Deteksi jenis berkas dari isi (magic bytes), bukan dari nama berkas atau header Content-Type kiriman
// peramban (docs/02 bagian 5). Murni, sehingga dapat diuji tanpa penyimpanan objek.

export type FileKind = "document" | "image" | "video";

export interface DetectedType {
  mime: string;
  ext: string;
  kind: FileKind;
}

const ascii = (bytes: Uint8Array, start: number, length: number) => String.fromCharCode(...bytes.subarray(start, start + length));

function startsWith(bytes: Uint8Array, signature: readonly number[], offset = 0): boolean {
  return signature.every((b, i) => bytes[offset + i] === b);
}

/** Mencari teks di awal berkas; dipakai untuk membedakan dokumen Office berbasis ZIP (word/ atau xl/). */
function containsAscii(bytes: Uint8Array, needle: string): boolean {
  const target = [...needle].map((c) => c.charCodeAt(0));
  outer: for (let i = 0; i + target.length <= bytes.length; i++) {
    for (let j = 0; j < target.length; j++) if (bytes[i + j] !== target[j]) continue outer;
    return true;
  }
  return false;
}

/**
 * Jenis berkas dari sekitar 64 KB pertama. Dokumen Office lama (.doc, .xls) berformat OLE yang sama, sehingga
 * dibedakan dari ekstensi nama berkas yang dinyatakan pengunggah.
 */
export function detectFileType(head: Uint8Array, declaredName = ""): DetectedType | null {
  if (head.length < 4) return null;
  if (ascii(head, 0, 5) === "%PDF-") return { mime: "application/pdf", ext: "pdf", kind: "document" };
  if (startsWith(head, [0xff, 0xd8, 0xff])) return { mime: "image/jpeg", ext: "jpg", kind: "image" };
  if (startsWith(head, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { mime: "image/png", ext: "png", kind: "image" };
  if (ascii(head, 0, 4) === "RIFF" && ascii(head, 8, 4) === "WEBP") return { mime: "image/webp", ext: "webp", kind: "image" };
  if (startsWith(head, [0x1a, 0x45, 0xdf, 0xa3])) return { mime: "video/webm", ext: "webm", kind: "video" };
  if (ascii(head, 4, 4) === "ftyp") {
    const brand = ascii(head, 8, 4);
    if (["heic", "heix", "hevc", "heim", "heis", "mif1", "msf1"].includes(brand)) return { mime: "image/heic", ext: "heic", kind: "image" };
    if (brand === "qt  ") return { mime: "video/quicktime", ext: "mov", kind: "video" };
    if (["isom", "iso2", "iso4", "iso5", "iso6", "mp41", "mp42", "avc1", "M4V ", "dash"].includes(brand)) return { mime: "video/mp4", ext: "mp4", kind: "video" };
    return null;
  }
  if (startsWith(head, [0x50, 0x4b, 0x03, 0x04])) {
    if (containsAscii(head, "word/")) return { mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", ext: "docx", kind: "document" };
    if (containsAscii(head, "xl/")) return { mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ext: "xlsx", kind: "document" };
    return null;
  }
  if (startsWith(head, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) {
    const ext = declaredName.toLowerCase().split(".").pop();
    if (ext === "doc") return { mime: "application/msword", ext: "doc", kind: "document" };
    if (ext === "xls") return { mime: "application/vnd.ms-excel", ext: "xls", kind: "document" };
    return null;
  }
  return null;
}

/** Bukti (docs/01 M5): PDF, gambar, Excel, dan Word. */
export const EVIDENCE_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/msword",
  "application/vnd.ms-excel",
] as const;

/** Observasi digital (docs/01 M6): foto dan video dari kamera perangkat. */
export const OBSERVATION_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "video/webm", "video/mp4", "video/quicktime"] as const;

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
