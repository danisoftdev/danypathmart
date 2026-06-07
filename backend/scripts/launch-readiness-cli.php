<?php



declare(strict_types=1);



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

use App\Helpers\LaunchReadinessService;



$pdo = Database::pdo();

$p1 = LaunchReadinessService::evaluate($pdo);

$p2 = $p1['p2'] ?? LaunchReadinessService::evaluateP2($pdo, (bool) ($p1['ready'] ?? false));

$p3 = $p1['p3'] ?? LaunchReadinessService::evaluateP3($pdo, (bool) ($p2['ready'] ?? false));

$p4 = $p1['p4'] ?? LaunchReadinessService::evaluateP4($pdo, (bool) ($p3['ready'] ?? false));

$p5 = $p1['p5'] ?? LaunchReadinessService::evaluateP5($pdo, (bool) ($p4['ready'] ?? false));



echo 'P1 ready: ' . (($p1['ready'] ?? false) ? 'YES' : 'NO') . "\n";

echo 'P2 ready: ' . (($p2['ready'] ?? false) ? 'YES' : 'NO') . "\n";

echo 'P3 ready: ' . (($p3['ready'] ?? false) ? 'YES' : 'NO') . "\n";

echo 'P4 ready: ' . (($p4['ready'] ?? false) ? 'YES' : 'NO') . "\n";

echo 'P5 ready: ' . (($p5['ready'] ?? false) ? 'YES' : 'NO') . "\n\n";



foreach (['P1' => $p1, 'P2' => $p2, 'P3' => $p3, 'P4' => $p4, 'P5' => $p5] as $label => $phase) {

    $summary = $phase['summary'] ?? ['pass' => 0, 'warn' => 0, 'fail' => 0];

    echo "── {$label}: pass {$summary['pass']} · warn {$summary['warn']} · fail {$summary['fail']}\n";

    foreach ($phase['checks'] ?? [] as $c) {

        $icon = match ($c['status']) {

            'pass' => '✓',

            'warn' => '!',

            default => '✗',

        };

        echo "  {$icon} {$c['label']}: {$c['message']}\n";

    }

    echo "\n";

}



$allReady = ($p1['ready'] ?? false) && ($p2['ready'] ?? false) && ($p3['ready'] ?? false)

    && ($p4['ready'] ?? false) && ($p5['ready'] ?? false);

exit($allReady ? 0 : 1);

