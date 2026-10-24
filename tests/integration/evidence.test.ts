// Bukti (docs/01 M5) dan observasi digital (docs/01 M6) terhadap PostgreSQL dan MinIO dari docker compose.

import { createHash, randomBytes } from "node:crypto";
import { config } from "dotenv";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

config({ quiet: true });
process.env.DATABASE_URL = inject("databaseUrl");
process.env.DATA_ENCRYPTION_KEY ??= randomBytes(32).toString("base64");

const evidence = await import("@/lib/evidence/service");
const observations = await import("@/lib/observations/service");
const { inspectObject } = await import("@/lib/storage");
const { getDb } = await import("@/lib/db");

const db = getDb();
const meta = { ipHash: null, userAgent: "vitest" };
const suffix = randomBytes(4).toString("hex");
const sha = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");

const PDF = new TextEncoder().encode(`%PDF-1.7\n1 0 obj << /Type /Catalog >> endobj\n${"x".repeat(2000)}\n%%EOF`);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, ...new TextEncoder().encode("JFIF"), ...randomBytes(3000)]);
const HTML = new TextEncoder().encode("<html><script>alert(1)</script></html>");

let admin: Parameters<typeof evidence.requestEvidenceUpload>[0];
let coordinator: Parameters<typeof evidence.requestEvidenceUpload>[0];
let assessor: Parameters<typeof observations.createObservationWindow>[0];
let assessmentId: string;
let unitA: string;
let unitB: string;
let characteristics: { id: string; requirements: string[] }[];

async function put(grant: { url: string; headers: Record<string, string> }, body: Uint8Array) {
  return fetch(grant.url, { method: "PUT", headers: grant.headers, body: Buffer.from(body) });
}

async function upload(actor = admin, overrides: Partial<Parameters<typeof evidence.requestEvidenceUpload>[1]> = {}, body: Uint8Array = PDF) {
  const grant = await evidence.requestEvidenceUpload(actor, {
    fileName: "notulen-rapat.pdf",
    size: body.length,
    contentType: "application/pdf",
    title: "Notulen rapat keselamatan",
    description: "",
    unitId: null,
    supersedesId: null,
    ...overrides,
  });
  const res = await put(grant, body);
  return { grant, res };
}

beforeAll(async () => {
  const org = await db.organization.create({ data: { name: `PT Uji M5 ${suffix}`, legalName: `PT Uji M5 ${suffix}` } });
  const [ca, uc, la] = await Promise.all(
    ["ca", "uc", "la"].map((p) => db.user.create({ data: { email: `${p}-m5-${suffix}@contoh.test`, name: `Pengguna ${p}`, passwordHash: "x" } })),
  );
  const version = await db.instrumentVersion.create({ data: { code: `TEST-M5-${suffix}`, status: "PUBLISHED", defaultParameters: {} } });
  const aspect = await db.aspect.create({ data: { instrumentVersionId: version.id, code: "A1", name: "Aspek" } });
  characteristics = [];
  for (let c = 1; c <= 2; c++) {
    const created = await db.characteristic.create({
      data: {
        instrumentVersionId: version.id,
        aspectId: aspect.id,
        code: `K1.${c}`,
        nameId: `Karakteristik ${c}`,
        order: c,
        evidenceRequirements: { create: [1, 2, 3].map((order) => ({ order, description: `Contoh bukti ${c}.${order}` })) },
      },
      select: { id: true, evidenceRequirements: { orderBy: { order: "asc" }, select: { id: true } } },
    });
    characteristics.push({ id: created.id, requirements: created.evidenceRequirements.map((r) => r.id) });
  }
  assessmentId = (
    await db.assessment.create({
      data: {
        organizationId: org.id,
        name: "Asesmen Uji M5",
        scopeType: "PROJECT",
        periodStart: new Date("2026-11-01"),
        periodEnd: new Date("2027-01-31"),
        targetLevel: 3,
        instrumentVersionId: version.id,
        status: "DATA_COLLECTION",
        parameterSnapshot: { parameters: { quality: { minEvidenceTypesPerCharacteristic: 2 } } },
      },
      select: { id: true },
    })
  ).id;
  unitA = (await db.unit.create({ data: { assessmentId, name: "Proyek A", type: "PROJECT", latitude: -6.2088, longitude: 106.8456, radiusMeters: 500 } })).id;
  unitB = (await db.unit.create({ data: { assessmentId, name: "Proyek B", type: "PROJECT" } })).id;
  const base = { assessmentId, organizationId: org.id };
  admin = { ...base, session: { user: { id: ca.id } } as never, roles: ["CLIENT_ADMIN"], unitScope: null };
  coordinator = { ...base, session: { user: { id: uc.id } } as never, roles: ["UNIT_COORDINATOR"], unitScope: [unitA] };
  assessor = { ...base, session: { user: { id: la.id } } as never, roles: ["LEAD_ASSESSOR"], unitScope: null };
});

afterAll(async () => {
  await db.$disconnect();
});

describe("unggah bukti langsung ke penyimpanan objek", () => {
  it("URL bertanda tangan, lalu ukuran, jenis dari isi, dan SHA-256 diverifikasi sebelum catatan dibuat", async () => {
    const { grant, res } = await upload();
    expect(res.status).toBe(200);
    expect(grant.url).toContain("X-Amz-Signature=");
    const c = characteristics[0]!;
    const result = await evidence.finalizeEvidenceUpload(admin, grant.ticket, [{ characteristicId: c.id, requirementIds: [c.requirements[0]!] }], meta);
    const item = await db.evidenceItem.findUniqueOrThrow({ where: { id: result.id }, include: { links: true } });
    expect(item).toMatchObject({ mimeType: "application/pdf", sizeBytes: PDF.length, sha256: sha(PDF), version: 1, title: "Notulen rapat keselamatan" });
    expect(item.storageKey).toMatch(new RegExp(`^${admin.organizationId}/${assessmentId}/evidence/[0-9a-f-]{36}\\.pdf$`));
    expect(item.links).toMatchObject([{ characteristicId: c.id, requirementIds: [c.requirements[0]] }]);
    expect(await db.auditLog.count({ where: { entityId: item.id, action: "evidence.upload" } })).toBe(1);
  });

  it("menolak berkas yang menyamar dan menghapusnya dari penyimpanan", async () => {
    const disguised = await upload(admin, { fileName: "laporan.pdf" }, HTML);
    expect(disguised.res.status).toBe(200);
    await expect(evidence.finalizeEvidenceUpload(admin, disguised.grant.ticket, null, meta)).rejects.toMatchObject({ code: "EVIDENCE_FILE_TYPE" });
    const key = (await import("@/lib/files/upload-ticket")).readUploadTicket(disguised.grant.ticket, { kind: "evidence", userId: admin.session.user.id, assessmentId })!.key;
    expect(await inspectObject(key, 1024 * 1024)).toBeNull();

    // Isi JPEG dengan nama .pdf juga ditolak: ekstensi tidak sesuai isi.
    const renamed = await upload(admin, { fileName: "dokumen.pdf", contentType: "application/pdf" }, JPEG);
    await expect(evidence.finalizeEvidenceUpload(admin, renamed.grant.ticket, null, meta)).rejects.toMatchObject({ code: "EVIDENCE_FILE_TYPE" });
  });

  it("ukuran yang berbeda dari yang dinyatakan tidak diterima", async () => {
    const grant = await evidence.requestEvidenceUpload(admin, {
      fileName: "a.pdf",
      size: PDF.length + 10,
      contentType: "application/pdf",
      title: "Ukuran salah",
      description: "",
      unitId: null,
      supersedesId: null,
    });
    const res = await put(grant, PDF);
    // Ukuran ditandatangani di URL; bila penyimpanan tetap menerimanya, server menolak saat penyelesaian.
    if (res.ok) await expect(evidence.finalizeEvidenceUpload(admin, grant.ticket, null, meta)).rejects.toMatchObject({ code: "FILE_SIZE_MISMATCH" });
    else expect(res.status).toBeGreaterThanOrEqual(400);
    await expect(
      evidence.requestEvidenceUpload(admin, { fileName: "besar.pdf", size: 26 * 1024 * 1024, contentType: "application/pdf", title: "Besar", description: "", unitId: null, supersedesId: null }),
    ).rejects.toMatchObject({ status: 413, code: "FILE_TOO_LARGE" });
  });

  it("tiket hanya berlaku untuk pengguna yang memintanya", async () => {
    const { grant } = await upload();
    await expect(evidence.finalizeEvidenceUpload(coordinator, grant.ticket, null, meta)).rejects.toMatchObject({ code: "UPLOAD_EXPIRED" });
    await expect(evidence.finalizeEvidenceUpload(admin, "tiket-palsu", null, meta)).rejects.toMatchObject({ code: "UPLOAD_EXPIRED" });
  });

  it("koordinator unit hanya mengunggah untuk unitnya", async () => {
    await expect(upload(coordinator, { unitId: null })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(upload(coordinator, { unitId: unitB })).rejects.toMatchObject({ code: "FORBIDDEN" });
    const { grant } = await upload(coordinator, { unitId: unitA, title: "Foto rambu proyek A", fileName: "rambu.jpg", contentType: "image/jpeg" }, JPEG);
    const { id } = await evidence.finalizeEvidenceUpload(coordinator, grant.ticket, [{ characteristicId: characteristics[1]!.id, requirementIds: [] }], meta);
    expect((await evidence.listEvidence(assessmentId, [unitA])).map((e) => e.id)).toEqual([id]);
  });
});

describe("versi, pemetaan, daftar periksa, dan penghapusan logis", () => {
  it("versi baru mewarisi pemetaan, versi lama tetap tersimpan", async () => {
    const c = characteristics[0]!;
    const first = await upload(admin, { title: "Prosedur izin kerja" });
    const v1 = await evidence.finalizeEvidenceUpload(admin, first.grant.ticket, [{ characteristicId: c.id, requirementIds: [c.requirements[1]!] }], meta);
    const second = await upload(admin, { title: "Prosedur izin kerja", supersedesId: v1.id }, new TextEncoder().encode(`%PDF-1.7 revisi ${"y".repeat(500)}`));
    const v2 = await evidence.finalizeEvidenceUpload(admin, second.grant.ticket, null, meta);
    expect(v2.version).toBe(2);

    const listed = (await evidence.listEvidence(assessmentId, null)).find((e) => e.id === v2.id)!;
    expect(listed.previousVersions.map((v) => v.version)).toEqual([1]);
    expect(listed.links.map((l) => l.requirementIds)).toEqual([[c.requirements[1]]]);
    expect((await evidence.listEvidence(assessmentId, null)).some((e) => e.id === v1.id)).toBe(false);
    expect(await evidence.evidenceForDownload(assessmentId, v1.id, null)).not.toBeNull();
    // Versi lama tidak dapat diganti lagi.
    await expect(upload(admin, { supersedesId: v1.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await db.auditLog.count({ where: { entityId: v2.id, action: "evidence.version" } })).toBe(1);
  });

  it("daftar periksa menandai butir terpenuhi dan karakteristik dengan kurang dari dua jenis bukti", async () => {
    const { rows, minTypes } = await evidence.loadEvidenceChecklist(assessmentId, null);
    expect(minTypes).toBe(2);
    const [k11, k12] = rows;
    expect(k11?.requirements.map((r) => r.met)).toEqual([true, true, false]);
    expect(k11).toMatchObject({ types: 2, belowMinimum: false });
    expect(k12).toMatchObject({ types: 1, belowMinimum: true });
  });

  it("pemetaan dapat diubah dan bukti dapat dihapus secara logis, keduanya tercatat", async () => {
    const target = (await evidence.listEvidence(assessmentId, null)).find((e) => e.title === "Notulen rapat keselamatan")!;
    await evidence.updateEvidenceLinks(admin, target.id, [{ characteristicId: characteristics[1]!.id, requirementIds: [characteristics[1]!.requirements[2]!] }], meta);
    await expect(evidence.updateEvidenceLinks(admin, target.id, [{ characteristicId: characteristics[1]!.id, requirementIds: [characteristics[0]!.requirements[0]!] }], meta)).rejects.toMatchObject({ code: "UNKNOWN_ITEM" });
    await evidence.deleteEvidence(admin, target.id, meta);
    expect((await evidence.listEvidence(assessmentId, null)).some((e) => e.id === target.id)).toBe(false);
    expect((await db.evidenceItem.findUniqueOrThrow({ where: { id: target.id } })).deletedAt).not.toBeNull();
    expect(await db.auditLog.count({ where: { entityId: target.id, action: { in: ["evidence.map", "evidence.delete"] } } })).toBe(2);
  });
});

describe("observasi digital", () => {
  let windowId: string;
  const now = new Date();
  const wib = (d: Date) => new Date(d.getTime() + 7 * 3600_000).toISOString().slice(0, 16);

  beforeAll(async () => {
    ({ id: windowId } = await observations.createObservationWindow(
      assessor,
      {
        unitId: unitA,
        title: "Observasi area kerja minggu pertama",
        opensAt: new Date(`${wib(new Date(now.getTime() - 3600_000))}:00+07:00`),
        closesAt: new Date(`${wib(new Date(now.getTime() + 3600_000))}:00+07:00`),
        checklist: [
          { code: "O1", label: "Pemakaian alat pelindung diri" },
          { code: "O2", label: "Rambu dan pembatas area" },
        ],
        latitude: -6.2088,
        longitude: 106.8456,
        radiusMeters: 500,
      },
      meta,
    ));
  });

  async function capture(location: { latitude: number; longitude: number; accuracy: number } | null, body: Uint8Array = JPEG, at = now) {
    const grant = await observations.requestCaptureUpload(coordinator, windowId, { checklistItemCode: "O1", contentType: "image/jpeg", size: body.length, location }, at);
    expect((await put(grant, body)).status).toBe(200);
    return grant;
  }

  it("waktu dicatat server, lokasi dan akurasi tersimpan, di dalam radius tidak ditandai", async () => {
    const grant = await capture({ latitude: -6.2089, longitude: 106.8457, accuracy: 12 });
    const result = await observations.finalizeCapture(coordinator, grant.ticket, "APD lengkap di area bekisting", meta);
    const stored = await db.observationCapture.findUniqueOrThrow({ where: { id: result.id } });
    expect(stored).toMatchObject({ outsideRadius: false, accuracyMeters: 12, mimeType: "image/jpeg", sha256: sha(JPEG), checklistItemCode: "O1" });
    expect(Math.abs(stored.serverCapturedAt.getTime() - now.getTime())).toBeLessThan(1000);
    expect(stored.distanceFromSiteMeters).toBeLessThan(50);
  });

  it("di luar radius diterima tetapi ditandai; tanpa lokasi tidak ditandai", async () => {
    const far = await capture({ latitude: -6.3, longitude: 106.8456, accuracy: 30 });
    expect(far.outsideRadius).toBe(true);
    expect((await observations.finalizeCapture(coordinator, far.ticket, "", meta)).outsideRadius).toBe(true);
    const unknown = await capture(null);
    expect((await observations.finalizeCapture(coordinator, unknown.ticket, "", meta)).outsideRadius).toBe(false);
  });

  it("di luar jendela waktu, butir tidak dikenal, unit lain, atau isi bukan foto atau video ditolak", async () => {
    await expect(
      observations.requestCaptureUpload(coordinator, windowId, { checklistItemCode: "O1", contentType: "image/jpeg", size: 100, location: null }, new Date(now.getTime() + 3 * 3600_000)),
    ).rejects.toMatchObject({ code: "OUTSIDE_WINDOW" });
    await expect(observations.requestCaptureUpload(coordinator, windowId, { checklistItemCode: "O9", contentType: "image/jpeg", size: 100, location: null }, now)).rejects.toMatchObject({
      code: "UNKNOWN_ITEM",
    });
    await expect(
      observations.requestCaptureUpload({ ...coordinator, unitScope: [unitB] }, windowId, { checklistItemCode: "O1", contentType: "image/jpeg", size: 100, location: null }, now),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    const pdf = await capture(null, PDF);
    await expect(observations.finalizeCapture(coordinator, pdf.ticket, "", meta)).rejects.toMatchObject({ code: "FILE_TYPE" });
    expect(await db.auditLog.count({ where: { assessmentId, action: "observation.capture" } })).toBe(3);
  });
});
