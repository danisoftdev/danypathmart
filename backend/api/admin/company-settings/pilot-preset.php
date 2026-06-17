<?php



declare(strict_types=1);



use App\Config\Database;

use App\Helpers\PilotPresetService;

use App\Helpers\Response;

use App\Middleware\AuthMiddleware;

use App\Middleware\PermissionMiddleware;



AuthMiddleware::requireAdmin();
AuthMiddleware::requireSuperAdmin();



$pdo = Database::pdo();

$disabled = PilotPresetService::apply($pdo);



Response::success([

    'message'  => 'Pilot preset applied — extended modules turned off. Core store and checkout unchanged.',

    'disabled' => $disabled,

]);

