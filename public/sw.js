// Service worker aplikasi kamera observasi (fase R12). Sengaja minimal: tidak menyimpan halaman, data, maupun rekaman
// apa pun; hanya menampilkan halaman luring bila navigasi gagal karena tidak ada sambungan.
const OFFLINE = '/offline.html';
const CACHE = 'nscas-offline-v1';

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches
            .open(CACHE)
            .then((cache) => cache.add(OFFLINE))
            .then(() => self.skipWaiting()),
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches
            .keys()
            .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
            .then(() => self.clients.claim()),
    );
});

self.addEventListener('fetch', (event) => {
    if (event.request.mode !== 'navigate') {
        return;
    }
    event.respondWith(fetch(event.request).catch(() => caches.match(OFFLINE)));
});
