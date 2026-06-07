<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;

AuthMiddleware::requireAdmin();
PermissionMiddleware::requireAny(['manage_careers', 'view_company_settings', 'hire_employees']);

$id = (int) ($_GET['id'] ?? 0);
if ($id <= 0) {
    Response::error('Invalid application id.', 422);
}

$pdo = Database::pdo();
$stmt = $pdo->prepare('DELETE FROM job_applications WHERE id = ?');
$stmt->execute([$id]);

if ($stmt->rowCount() === 0) {
    Response::error('Application not found.', 404);
}

Response::success(['message' => 'Application deleted.']);
