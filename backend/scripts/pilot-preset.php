<?php



declare(strict_types=1);



/**

 * Phase 1 pilot preset — turn off logistics, marketplace, HR, and analytics toggles.

 * Usage: php backend/scripts/pilot-preset.php

 */



require __DIR__ . '/../vendor/autoload.php';



spl_autoload_register(static function (string $class): void {

    $prefix = 'App\\';

    if (!str_starts_with($class, $prefix)) {

        return;

    }

    $relative = substr($class, strlen($prefix));

    $parts = explode('\\', $relative);

    $dir = strtolower(array_shift($parts));

    $path = __DIR__ . '/../' . $dir . '/' . implode('/', $parts) . '.php';

    if (is_file($path)) {

        require $path;

    }

});



use App\Config\Database;

use App\Helpers\PilotPresetService;



$pdo = Database::pdo();

$disabled = PilotPresetService::apply($pdo);



echo "DanyPathMart — pilot preset applied\n";

echo str_repeat('-', 40) . "\n";

foreach ($disabled as $label) {

    echo "  ✓ Off: {$label}\n";

}

echo "\nNext: php backend/scripts/pilot-smoke-test.php\n";

echo "      php backend/scripts/launch-readiness-cli.php\n";

