<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Teks validasi
    |--------------------------------------------------------------------------
    |
    | Pesan galat bawaan pemvalidasi. Kuncinya sama dengan lang/en/validation.php.
    | Nama kolom ditulis dengan :Attribute (huruf awal besar) di awal kalimat dan
    | :attribute di tengah kalimat. Aturan bahasa ada di docs/05 bagian 4.
    |
    */

    'accepted' => ':Attribute harus disetujui.',
    'accepted_if' => ':Attribute harus disetujui jika :other bernilai :value.',
    'active_url' => ':Attribute harus berupa alamat web yang valid.',
    'after' => ':Attribute harus berisi tanggal setelah :date.',
    'after_or_equal' => ':Attribute harus berisi tanggal :date atau setelahnya.',
    'alpha' => ':Attribute hanya boleh berisi huruf.',
    'alpha_dash' => ':Attribute hanya boleh berisi huruf, angka, tanda hubung, dan garis bawah.',
    'alpha_num' => ':Attribute hanya boleh berisi huruf dan angka.',
    'any_of' => ':Attribute tidak valid.',
    'array' => ':Attribute harus berupa larik.',
    'array_keys' => ':Attribute hanya boleh memuat kunci berikut: :values.',
    'ascii' => ':Attribute hanya boleh berisi huruf, angka, dan simbol satu bita.',
    'base64' => ':Attribute harus berupa teks Base64 yang valid.',
    'before' => ':Attribute harus berisi tanggal sebelum :date.',
    'before_or_equal' => ':Attribute harus berisi tanggal :date atau sebelumnya.',
    'between' => [
        'array' => ':Attribute harus memuat :min sampai :max butir.',
        'file' => ':Attribute harus berukuran :min sampai :max kilobita.',
        'numeric' => ':Attribute harus bernilai :min sampai :max.',
        'string' => ':Attribute harus terdiri atas :min sampai :max karakter.',
    ],
    'boolean' => ':Attribute harus bernilai benar atau salah.',
    'can' => ':Attribute memuat nilai yang tidak diizinkan.',
    'confirmed' => 'Ulangan :attribute tidak sama.',
    'contains' => ':Attribute belum memuat nilai yang diwajibkan.',
    'current_password' => 'Kata sandi yang Anda masukkan tidak sesuai. Periksa kembali, lalu coba lagi.',
    'date' => ':Attribute harus berupa tanggal yang valid.',
    'date_equals' => ':Attribute harus berisi tanggal :date.',
    'date_format' => ':Attribute harus sesuai dengan format :format.',
    'decimal' => ':Attribute harus memiliki :decimal angka di belakang koma.',
    'declined' => ':Attribute harus ditolak.',
    'declined_if' => ':Attribute harus ditolak jika :other bernilai :value.',
    'different' => ':Attribute dan :other harus berbeda.',
    'digits' => ':Attribute harus terdiri atas :digits angka.',
    'digits_between' => ':Attribute harus terdiri atas :min sampai :max angka.',
    'dimensions' => 'Ukuran gambar :attribute tidak sesuai.',
    'distinct' => ':Attribute memuat nilai yang sama lebih dari satu kali.',
    'doesnt_contain' => ':Attribute tidak boleh memuat salah satu dari nilai berikut: :values.',
    'doesnt_end_with' => ':Attribute tidak boleh diakhiri dengan salah satu dari nilai berikut: :values.',
    'doesnt_start_with' => ':Attribute tidak boleh diawali dengan salah satu dari nilai berikut: :values.',
    'email' => ':Attribute harus berupa alamat surel yang valid.',
    'encoding' => ':Attribute harus memakai pengodean :encoding.',
    'ends_with' => ':Attribute harus diakhiri dengan salah satu dari nilai berikut: :values.',
    'enum' => ':Attribute yang dipilih tidak valid.',
    'exists' => ':Attribute yang dipilih tidak valid.',
    'extensions' => ':Attribute harus memiliki salah satu ekstensi berikut: :values.',
    'file' => ':Attribute harus berupa berkas.',
    'filled' => ':Attribute tidak boleh kosong.',
    'gt' => [
        'array' => ':Attribute harus memuat lebih dari :value butir.',
        'file' => ':Attribute harus berukuran lebih dari :value kilobita.',
        'numeric' => ':Attribute harus bernilai lebih dari :value.',
        'string' => ':Attribute harus terdiri atas lebih dari :value karakter.',
    ],
    'gte' => [
        'array' => ':Attribute harus memuat :value butir atau lebih.',
        'file' => ':Attribute harus berukuran :value kilobita atau lebih.',
        'numeric' => ':Attribute harus bernilai :value atau lebih.',
        'string' => ':Attribute harus terdiri atas :value karakter atau lebih.',
    ],
    'hex_color' => ':Attribute harus berupa kode warna heksadesimal yang valid.',
    'image' => ':Attribute harus berupa gambar.',
    'in' => ':Attribute yang dipilih tidak valid.',
    'in_array' => ':Attribute harus terdapat dalam :other.',
    'in_array_keys' => ':Attribute harus memuat sedikitnya satu dari kunci berikut: :values.',
    'integer' => ':Attribute harus berupa bilangan bulat.',
    'ip' => ':Attribute harus berupa alamat IP yang valid.',
    'ipv4' => ':Attribute harus berupa alamat IPv4 yang valid.',
    'ipv6' => ':Attribute harus berupa alamat IPv6 yang valid.',
    'json' => ':Attribute harus berupa teks JSON yang valid.',
    'list' => ':Attribute harus berupa daftar.',
    'lowercase' => ':Attribute harus ditulis dengan huruf kecil.',
    'lt' => [
        'array' => ':Attribute harus memuat kurang dari :value butir.',
        'file' => ':Attribute harus berukuran kurang dari :value kilobita.',
        'numeric' => ':Attribute harus bernilai kurang dari :value.',
        'string' => ':Attribute harus terdiri atas kurang dari :value karakter.',
    ],
    'lte' => [
        'array' => ':Attribute tidak boleh memuat lebih dari :value butir.',
        'file' => ':Attribute harus berukuran :value kilobita atau kurang.',
        'numeric' => ':Attribute harus bernilai :value atau kurang.',
        'string' => ':Attribute harus terdiri atas :value karakter atau kurang.',
    ],
    'mac_address' => ':Attribute harus berupa alamat MAC yang valid.',
    'max' => [
        'array' => ':Attribute tidak boleh memuat lebih dari :max butir.',
        'file' => ':Attribute tidak boleh berukuran lebih dari :max kilobita.',
        'numeric' => ':Attribute tidak boleh bernilai lebih dari :max.',
        'string' => ':Attribute tidak boleh melebihi :max karakter.',
    ],
    'max_digits' => ':Attribute tidak boleh melebihi :max angka.',
    'mimes' => ':Attribute harus berupa berkas dengan jenis berikut: :values.',
    'mimetypes' => ':Attribute harus berupa berkas dengan jenis berikut: :values.',
    'min' => [
        'array' => ':Attribute harus memuat sedikitnya :min butir.',
        'file' => ':Attribute harus berukuran sedikitnya :min kilobita.',
        'numeric' => ':Attribute harus bernilai sedikitnya :min.',
        'string' => ':Attribute harus terdiri atas sedikitnya :min karakter.',
    ],
    'min_digits' => ':Attribute harus terdiri atas sedikitnya :min angka.',
    'missing' => ':Attribute tidak boleh disertakan.',
    'missing_if' => ':Attribute tidak boleh disertakan jika :other bernilai :value.',
    'missing_unless' => ':Attribute tidak boleh disertakan kecuali :other bernilai :value.',
    'missing_with' => ':Attribute tidak boleh disertakan jika salah satu dari :values diisi.',
    'missing_with_all' => ':Attribute tidak boleh disertakan jika :values seluruhnya diisi.',
    'multiple_of' => ':Attribute harus merupakan kelipatan :value.',
    'not_in' => ':Attribute yang dipilih tidak valid.',
    'not_regex' => 'Format :attribute tidak valid.',
    'numeric' => ':Attribute harus berupa angka.',
    'password' => [
        'letters' => ':Attribute harus memuat sedikitnya satu huruf.',
        'mixed' => ':Attribute harus memuat sedikitnya satu huruf besar dan satu huruf kecil.',
        'numbers' => ':Attribute harus memuat sedikitnya satu angka.',
        'symbols' => ':Attribute harus memuat sedikitnya satu simbol.',
        'uncompromised' => ':Attribute ini pernah muncul dalam kebocoran data. Gunakan :attribute lain.',
    ],
    'present' => ':Attribute harus disertakan.',
    'present_if' => ':Attribute harus disertakan jika :other bernilai :value.',
    'present_unless' => ':Attribute harus disertakan kecuali :other bernilai :value.',
    'present_with' => ':Attribute harus disertakan jika salah satu dari :values diisi.',
    'present_with_all' => ':Attribute harus disertakan jika :values seluruhnya diisi.',
    'prohibited' => ':Attribute tidak boleh diisi.',
    'prohibited_if' => ':Attribute tidak boleh diisi jika :other bernilai :value.',
    'prohibited_if_accepted' => ':Attribute tidak boleh diisi jika :other disetujui.',
    'prohibited_if_declined' => ':Attribute tidak boleh diisi jika :other ditolak.',
    'prohibited_unless' => ':Attribute tidak boleh diisi kecuali :other bernilai salah satu dari :values.',
    'prohibits' => 'Jika :attribute diisi, :other tidak boleh diisi.',
    'regex' => 'Format :attribute tidak valid.',
    'required' => ':Attribute wajib diisi.',
    'required_array_keys' => ':Attribute harus memuat isian untuk: :values.',
    'required_if' => ':Attribute wajib diisi jika :other bernilai :value.',
    'required_if_accepted' => ':Attribute wajib diisi jika :other disetujui.',
    'required_if_declined' => ':Attribute wajib diisi jika :other ditolak.',
    'required_unless' => ':Attribute wajib diisi kecuali :other bernilai salah satu dari :values.',
    'required_with' => ':Attribute wajib diisi jika salah satu dari :values diisi.',
    'required_with_all' => ':Attribute wajib diisi jika :values seluruhnya diisi.',
    'required_without' => ':Attribute wajib diisi jika salah satu dari :values tidak diisi.',
    'required_without_all' => ':Attribute wajib diisi jika tidak satu pun dari :values diisi.',
    'same' => ':Attribute harus sama dengan :other.',
    'size' => [
        'array' => ':Attribute harus memuat :size butir.',
        'file' => ':Attribute harus berukuran :size kilobita.',
        'numeric' => ':Attribute harus bernilai :size.',
        'string' => ':Attribute harus terdiri atas :size karakter.',
    ],
    'starts_with' => ':Attribute harus diawali dengan salah satu dari nilai berikut: :values.',
    'string' => ':Attribute harus berupa teks.',
    'timezone' => ':Attribute harus berupa zona waktu yang valid.',
    'unique' => ':Attribute telah digunakan.',
    'uploaded' => ':Attribute gagal diunggah.',
    'uppercase' => ':Attribute harus ditulis dengan huruf besar.',
    'url' => ':Attribute harus berupa alamat web yang valid.',
    'ulid' => ':Attribute harus berupa ULID yang valid.',
    'uuid' => ':Attribute harus berupa UUID yang valid.',

    /*
    |--------------------------------------------------------------------------
    | Pesan validasi khusus
    |--------------------------------------------------------------------------
    |
    | Pesan khusus untuk pasangan kolom dan aturan tertentu ditulis di sini
    | dengan pola "kolom.aturan".
    |
    */

    'custom' => [
        'attribute-name' => [
            'rule-name' => 'custom-message',
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Nama kolom
    |--------------------------------------------------------------------------
    |
    | Nama yang menggantikan :attribute agar pesan mudah dibaca, misalnya
    | "surel" untuk kolom "email".
    |
    */

    'attributes' => [
        'email' => 'surel',
        'password' => 'kata sandi',
        'current_password' => 'kata sandi saat ini',
        'name' => 'nama',
        'code' => 'kode verifikasi',
        'recovery_code' => 'kode pemulihan',
    ],

];
