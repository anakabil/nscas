<?php

declare(strict_types=1);

namespace App\Domain\Validation;

/** Kode baku hasil validasi lapangan untuk analisis (bahan validasi versi 2). Murni. */
final class FieldCoding
{
    /** Kode bukti jawaban wawancara atau diskusi: contoh nyata dan konsisten, sebagian, atau tidak ada contoh. */
    public const EVIDENCE = ['CONSISTENT', 'PARTIAL', 'NONE'];

    /** Tingkat kesepakatan peserta diskusi kelompok terarah. */
    public const AGREEMENT = ['AGREED', 'MIXED', 'DIVIDED'];

    /** Hasil butir lembar kerja kunjungan proyek. */
    public const SITE_RESULTS = ['MEETS', 'PARTIAL', 'NOT_MET', 'NOT_OBSERVED'];

    /** Metode pemeriksaan butir kunjungan: periksa dokumen, amati, atau tanya pekerja. */
    public const METHODS = ['DOCUMENT', 'OBSERVE', 'ASK'];
}
