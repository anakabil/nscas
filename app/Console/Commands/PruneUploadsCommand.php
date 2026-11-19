<?php

namespace App\Console\Commands;

use App\Services\Files\UploadGrants;
use Illuminate\Console\Command;

/**
 * Menghapus izin unggah bukti dan observasi yang tidak pernah diselesaikan beserta berkasnya (fase R5), agar tidak
 * ada berkas tanpa catatan di penyimpanan objek. Dijadwalkan setiap jam (routes/console.php).
 */
class PruneUploadsCommand extends Command
{
    protected $signature = 'nscas:prune-uploads';

    protected $description = 'Hapus unggahan bukti dan observasi yang tidak diselesaikan';

    public function handle(UploadGrants $grants): int
    {
        $this->info('Unggahan tertunda dihapus: '.$grants->prune().'.');

        return self::SUCCESS;
    }
}
