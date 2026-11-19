<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Fase R2 (docs/01 M2): pengingat survei pukul 08.00 WIB dan cuplikan partisipasi pukul 23.00 WIB.
Schedule::command('nscas:survey-reminders')->dailyAt('08:00')->timezone('Asia/Jakarta')->withoutOverlapping();
Schedule::command('nscas:participation-snapshot')->dailyAt('23:00')->timezone('Asia/Jakarta')->withoutOverlapping();
// Fase R3 (docs/02 bagian 4): urutan fisik baris jawaban diacak setiap malam sebelum cadangan pukul 01.30 WIB (deploy/digitalocean), agar
// tabel dan cadangan tidak mengikuti urutan pengiriman.
Schedule::command('nscas:shuffle-survey-rows')->dailyAt('00:45')->timezone('Asia/Jakarta')->withoutOverlapping();
// Fase R5 (docs/02 bagian 5): izin unggah yang tidak diselesaikan dihapus beserta berkasnya.
Schedule::command('nscas:prune-uploads')->hourly()->withoutOverlapping();
