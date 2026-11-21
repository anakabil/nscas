<?php

// Respondent list Excel template (phase R2), carried over from v1 messages/en.json section respondents.template.

return [
    'template' => [
        'fileName' => 'respondent-list-template',
        'title' => 'Instructions for the respondent list',
        'optionsSheet' => 'Options',
        'instructionsSheet' => 'Instructions',
        'yes' => 'Ya',
        'no' => 'Tidak',
        'lines' => [
            '1. Enter one respondent per row in the "Daftar responden" sheet. Do not change the header row.',
            '2. Required columns: Name (Nama), Unit, and Stratum (Strata). Stratum may be left empty when the Job title (Jabatan) column holds a listed job title. Other columns may be left empty.',
            '3. Choose Unit and Stratum from the lists in the "Options" sheet so they match the assessment exactly. The recognised job titles and their strata are listed on the same sheet. Job titles are only used to find the stratum and are not stored.',
            '4. Email is used for invitations and reminders. Respondents without email can receive a link from the coordinator or use the unit QR code.',
            '5. Enter phone numbers as text, for example 081234567890. Numbers are stored in +62 format.',
            '6. Contractor (Penyedia jasa) is Ya (yes) or Tidak (no). If empty, the stratum setting applies.',
            '7. Employee numbers and emails must not repeat in the file or match respondents already registered.',
            '8. Contact data is stored encrypted and is never linked to survey answers.',
        ],
    ],
];
