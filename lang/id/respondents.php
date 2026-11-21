<?php

// Templat Excel daftar responden (fase R2), dibawa dari v1 messages/id.json bagian respondents.template.

return [
    'template' => [
        'fileName' => 'templat-daftar-responden',
        'title' => 'Petunjuk pengisian daftar responden',
        'optionsSheet' => 'Pilihan',
        'instructionsSheet' => 'Petunjuk',
        'yes' => 'Ya',
        'no' => 'Tidak',
        'lines' => [
            '1. Isi satu responden per baris di lembar "Daftar responden". Jangan mengubah baris judul.',
            '2. Kolom wajib: Nama, Unit, dan Strata. Kolom Strata boleh dikosongkan bila kolom Jabatan diisi dengan nama jabatan yang terdaftar. Kolom lain boleh dikosongkan.',
            '3. Unit dan Strata dipilih dari daftar di lembar "Pilihan" agar sama persis dengan data asesmen. Nama jabatan yang dikenali beserta strata tujuannya tercantum di lembar yang sama. Nama jabatan hanya dipakai untuk menentukan strata dan tidak disimpan.',
            '4. Surel dipakai untuk mengirim undangan dan pengingat. Responden tanpa surel dapat menerima tautan dari koordinator atau memakai kode QR unit.',
            '5. Telepon ditulis sebagai teks, misalnya 081234567890. Nomor akan disimpan dalam format +62.',
            '6. Penyedia jasa diisi Ya atau Tidak. Bila dikosongkan, mengikuti pengaturan strata.',
            '7. Nomor induk dan surel tidak boleh berulang di berkas maupun dengan responden yang sudah terdaftar.',
            '8. Data kontak disimpan terenkripsi dan tidak pernah dihubungkan dengan jawaban survei.',
        ],
    ],
];
