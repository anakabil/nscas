#!/usr/bin/env bash
# Server uji ujung ke ujung (fase R12): basis data tersendiri nscas_laravel_e2e yang dikosongkan setiap kali, akun uji,
# dan php artisan serve pada port E2E_PORT. Data pengembangan tidak tersentuh.
set -euo pipefail
cd "$(dirname "$0")/../.."
export DB_DATABASE="${E2E_DATABASE:-nscas_laravel_e2e}"
php -r '
$pdo = new PDO("pgsql:host=".(getenv("DB_HOST") ?: "127.0.0.1").";port=".(getenv("DB_PORT") ?: "5432").";dbname=postgres", getenv("DB_USERNAME") ?: "nscas", getenv("DB_PASSWORD") ?: "nscas_dev");
$name = getenv("DB_DATABASE");
if (! $pdo->query("select 1 from pg_database where datname = ".$pdo->quote($name))->fetchColumn()) { $pdo->exec("create database \"".$name."\""); }
' 2>/dev/null || true
php artisan migrate:fresh --seed --force --no-interaction >/dev/null
php artisan nscas:e2e-cycle accounts --password="${E2E_PASSWORD:-UjiSiklus2026}"
exec php artisan serve --host=127.0.0.1 --port="${E2E_PORT:-8100}" --no-reload
