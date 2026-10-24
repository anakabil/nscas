// Unggah langsung ke penyimpanan objek melalui URL bertanda tangan, dengan laporan kemajuan (XMLHttpRequest,
// karena fetch belum melaporkan kemajuan unggah). Berguna di lokasi proyek dengan sinyal lemah.

export function putFile(url: string, headers: Record<string, string>, body: Blob, onProgress: (percent: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    for (const [name, value] of Object.entries(headers)) xhr.setRequestHeader(name, value);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`UPLOAD_${xhr.status}`)));
    xhr.onerror = () => reject(new Error("NETWORK"));
    xhr.onabort = () => reject(new Error("NETWORK"));
    xhr.send(body);
  });
}
