<?php

// Pengingat tenggat rencana aksi (fase R9).

return [
    'subject' => 'Pengingat tenggat rencana aksi budaya keselamatan dan kesehatan kerja :organization',
    'greeting' => 'Yth. :name,',
    'intro' => 'Tindakan berikut pada rencana aksi :assessment mendekati atau sudah melewati tenggat:',
    'item' => ':code :title, tenggat :date (:state)',
    'states' => ['dueSoon' => 'segera jatuh tempo', 'overdue' => 'melewati tenggat'],
    'button' => 'Buka pemantauan rencana aksi',
    'closing' => 'Mohon perbarui kemajuannya di NSCAS. Terima kasih.',
    'signature' => 'Nusa Safety',
    'otherLanguage' => 'English version below.',
];
