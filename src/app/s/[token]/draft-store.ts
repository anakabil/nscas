// Draf jawaban survei hanya di perangkat responden (docs/02 bagian 4 butir 6): IndexedDB, dengan cadangan di
// memori bila peramban menolak IndexedDB (misalnya mode privat tertentu). Tidak ada draf yang dikirim ke server.

export interface SurveyDraft {
  v: 1;
  language: "id" | "en" | null;
  consented: boolean;
  stratumId: string | null;
  step: number;
  /** characteristicId -> id pernyataan, atau null untuk "Tidak tahu". */
  answers: Record<string, string | null>;
  /** itemId -> nilai 1 sampai 5. */
  climate: Record<string, number>;
  /** Waktu persetujuan dan waktu menekan Kirim (milidetik), hanya untuk menghitung durasi. */
  startedAt: number | null;
  finishedAt: number | null;
}

export function emptyDraft(): SurveyDraft {
  return { v: 1, language: null, consented: false, stratumId: null, step: 0, answers: {}, climate: {}, startedAt: null, finishedAt: null };
}

const DB_NAME = "nscas-survey";
const STORE = "drafts";
const memory = new Map<string, SurveyDraft>();

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      if (typeof indexedDB === "undefined") return resolve(null);
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function run<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest): Promise<T | undefined> {
  const db = await openDb();
  if (!db) return undefined;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, mode);
      const request = action(tx.objectStore(STORE));
      tx.oncomplete = () => {
        db.close();
        resolve(request.result as T);
      };
      tx.onerror = tx.onabort = () => {
        db.close();
        resolve(undefined);
      };
    } catch {
      db.close();
      resolve(undefined);
    }
  });
}

export async function loadDraft(key: string): Promise<SurveyDraft | null> {
  const stored = await run<SurveyDraft>("readonly", (s) => s.get(key));
  const draft = stored ?? memory.get(key) ?? null;
  return draft && draft.v === 1 ? draft : null;
}

export async function saveDraft(key: string, draft: SurveyDraft): Promise<void> {
  memory.set(key, draft);
  await run("readwrite", (s) => s.put(draft, key));
}

export async function deleteDraft(key: string): Promise<void> {
  memory.delete(key);
  await run("readwrite", (s) => s.delete(key));
}
