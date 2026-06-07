<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\KitBuilderService;
use App\Helpers\Response;

$slug = trim((string) ($_GET['slug'] ?? ''));
if ($slug === '') {
    Response::error('Kit not found.', 404);
}

$pdo = Database::pdo();
$kit = KitBuilderService::getBySlug($pdo, $slug, true);
if ($kit === null) {
    Response::error('Kit not found.', 404);
}

Response::success(['kit' => $kit]);
