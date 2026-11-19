// Unggah berkas dua langkah (fase R5, docs/02 bagian 5): minta izin ke server, kirim berkas ke tujuan unggah (URL
// bertanda tangan penyimpanan objek, atau aplikasi sendiri saat memakai disk lokal), lalu selesaikan agar server
// memeriksa isi berkas. Tidak ada pustaka tambahan; kemajuan unggah dari XMLHttpRequest.

export type UploadTarget = { url: string; method: string; headers: Record<string, string> };
export type Grant = { ticket: string; upload: UploadTarget };
export type JsonResult<T> = { ok: true; data: T } | { ok: false; status: number; message: string | null };

function xsrfToken(): string | null {
    const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/);
    return match ? decodeURIComponent(match[1] as string) : null;
}

/** POST JSON ke aplikasi dengan token XSRF dari cookie, seperti permintaan Inertia. */
export async function postJson<T>(url: string, body: unknown): Promise<JsonResult<T>> {
    const token = xsrfToken();
    let response: Response;
    try {
        response = await fetch(url, {
            method: 'POST',
            credentials: 'same-origin',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
                ...(token ? { 'X-XSRF-TOKEN': token } : {}),
            },
            body: JSON.stringify(body),
        });
    } catch {
        return { ok: false, status: 0, message: null };
    }
    const json = (await response.json().catch(() => ({}))) as { message?: string } & T;
    return response.ok ? { ok: true, data: json } : { ok: false, status: response.status, message: json.message ?? null };
}

/**
 * Mengirim berkas ke tujuan unggah dengan laporan kemajuan 0 sampai 1. Hasilnya kode status HTTP, atau 0 bila
 * sambungan terputus.
 */
export function sendFile(target: UploadTarget, file: Blob, onProgress: (fraction: number) => void): Promise<number> {
    return new Promise((resolve) => {
        const xhr = new XMLHttpRequest();
        xhr.open(target.method, target.url);
        // Unggah langsung ke penyimpanan objek tanpa cookie; unggah ke aplikasi sendiri memakai sesi.
        xhr.withCredentials = false;
        for (const [name, value] of Object.entries(target.headers)) {
            xhr.setRequestHeader(name, value);
        }
        xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
                onProgress(event.loaded / event.total);
            }
        };
        xhr.onload = () => resolve(xhr.status);
        xhr.onerror = () => resolve(0);
        xhr.onabort = () => resolve(0);
        xhr.send(file);
    });
}

/** Unggahan diterima tujuan unggah. */
export const uploaded = (status: number): boolean => status >= 200 && status < 300;
