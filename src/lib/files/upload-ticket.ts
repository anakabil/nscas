import "server-only";
import { openToken, sealToken } from "@/lib/privacy/crypto";

// Tiket unggah tersegel (AES-256-GCM) yang menghubungkan permintaan URL unggah dengan penyelesaiannya, tanpa
// tabel unggahan tertunda. Tiket hanya berlaku untuk pengguna, asesmen, dan kunci objek yang sama.

const PURPOSE = "upload-ticket";
export const UPLOAD_TICKET_TTL_MS = 15 * 60 * 1000;

export interface UploadTicket extends Record<string, unknown> {
  kind: "evidence" | "observation";
  key: string;
  userId: string;
  assessmentId: string;
  declaredSize: number;
  fileName: string;
  /** Data tambahan menurut jenis unggahan (misalnya judul bukti atau lokasi observasi). */
  data: Record<string, unknown>;
}

export function issueUploadTicket(ticket: UploadTicket, now = Date.now()): string {
  return sealToken(ticket, PURPOSE, UPLOAD_TICKET_TTL_MS, now);
}

export function readUploadTicket(raw: string, expected: { kind: UploadTicket["kind"]; userId: string; assessmentId: string }, now = Date.now()): UploadTicket | null {
  const ticket = openToken<UploadTicket>(raw, PURPOSE, now);
  if (!ticket || ticket.kind !== expected.kind || ticket.userId !== expected.userId || ticket.assessmentId !== expected.assessmentId) return null;
  return ticket;
}
