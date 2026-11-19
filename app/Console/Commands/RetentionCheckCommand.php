<?php

namespace App\Console\Commands;

use App\Mail\RetentionFlagMail;
use App\Models\User;
use App\Services\Retention\RetentionService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Mail;

/**
 * Tugas mingguan (docs/04 bagian 7): menandai asesmen yang melewati masa simpan data mentah dan memberi tahu pengelola
 * sistem. Tidak memusnahkan apa pun; pemusnahan dijalankan pengelola sistem setelah konfirmasi tertulis klien.
 */
class RetentionCheckCommand extends Command
{
    protected $signature = 'nscas:retention-check';

    protected $description = 'Menandai asesmen yang masa simpan data mentahnya telah berakhir';

    public function handle(RetentionService $retention): int
    {
        $flagged = $retention->flagExpired();
        if ($flagged !== []) {
            User::where('is_super_admin', true)->where('is_active', true)->get()->each(function (User $admin) use ($flagged) {
                Mail::to($admin->email)->queue(new RetentionFlagMail($admin->name, $admin->locale === 'en' ? 'en' : 'id', $flagged, route('retention.index')));
            });
        }
        $this->info(sprintf('%d asesmen ditandai.', count($flagged)));

        return self::SUCCESS;
    }
}
