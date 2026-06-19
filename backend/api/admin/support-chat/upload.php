<?php

declare(strict_types=1);

use App\Helpers\Response;
use App\Helpers\SupportChatService;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;

AuthMiddleware::requireAdmin();
PermissionMiddleware::requireAny(['manage_contact_inbox', 'view_company_settings']);

$file = $_FILES['image'] ?? null;
if (!is_array($file)) {
    Response::error('No image uploaded.', 422);
}

try {
    $result = SupportChatService::storeUploadedImage($file);
} catch (RuntimeException $e) {
    Response::error($e->getMessage(), 422);
} catch (Throwable $e) {
    Response::error('Could not upload image.', 500);
}

Response::success([
    'message' => 'Image uploaded.',
    'url'     => $result['url'],
]);
