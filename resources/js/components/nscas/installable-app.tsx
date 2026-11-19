import { Head } from '@inertiajs/react';
import { useEffect } from 'react';

/**
 * Menjadikan halaman kamera observasi dapat dipasang di layar utama telepon (keputusan R5, fase R12): manifes aplikasi
 * dan service worker minimal yang hanya menampilkan halaman luring. Tidak dipasang di halaman lain, termasuk survei.
 */
export function InstallableApp() {
    useEffect(() => {
        if ('serviceWorker' in navigator && window.isSecureContext) {
            navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => undefined);
        }
    }, []);

    return (
        <Head>
            <link rel="manifest" href="/manifest.webmanifest" />
            <meta name="mobile-web-app-capable" content="yes" />
            <meta name="apple-mobile-web-app-capable" content="yes" />
            <meta name="apple-mobile-web-app-title" content="NSCAS Lapangan" />
        </Head>
    );
}
