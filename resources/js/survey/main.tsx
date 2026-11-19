import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { SurveyApp } from './survey-app';
import type { SurveyData } from './survey-app';

// Titik masuk paket survei (fase R3). Terpisah dari konsol (resources/js/app.tsx): tanpa Inertia, tanpa komponen
// konsol, agar muatan halaman survei kecil (docs/01 M3, batas 350 KB terkompresi). Data survei disisipkan server
// sebagai JSON di dalam halaman, sehingga tidak ada permintaan tambahan sebelum survei dapat diisi.

const root = document.getElementById('survey-root');
const source = document.getElementById('survey-data');
if (root && source?.textContent) {
    const data = JSON.parse(source.textContent) as SurveyData;
    createRoot(root).render(
        <StrictMode>
            <SurveyApp data={data} />
        </StrictMode>,
    );
}
