import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { SelfAssessmentApp } from './form-app';
import type { FormData } from './form-app';

// Titik masuk formulir penilaian mandiri bertoken (fase R4). Terpisah dari konsol, seperti halaman survei.
const root = document.getElementById('sa-root');
const source = document.getElementById('sa-data');
if (root && source?.textContent) {
    createRoot(root).render(
        <StrictMode>
            <SelfAssessmentApp data={JSON.parse(source.textContent) as FormData} />
        </StrictMode>,
    );
}
