// guard-exempt: pwa-service-worker. Service worker minimal untuk rute observasi agar dapat dipasang sebagai PWA.
// Sengaja tidak menyimpan halaman atau rekaman di singgahan: rekaman harus dikirim saat jendela observasi terbuka
// dan waktu dicatat server, sehingga mode luring tidak didukung.

const SCRIPT = `
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
`;

export function GET() {
  return new Response(SCRIPT, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-cache",
      "Service-Worker-Allowed": "/o",
    },
  });
}
