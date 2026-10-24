"use client";

import { useEffect } from "react";

/** Mendaftarkan service worker berlingkup /o agar aplikasi observasi dapat dipasang di layar utama. */
export function ServiceWorker() {
  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/o/sw.js", { scope: "/o" }).catch(() => undefined);
  }, []);
  return null;
}
