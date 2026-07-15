<?php

declare(strict_types=1);

use App\Helpers\Response;
use App\Helpers\SupportChatService;
use App\Middleware\ShopMiddleware;

ShopMiddleware::requireShopMember();

try {
    $result = SupportChatService::storeUploadedImage($_FILES['image'] ?? []);
} catch (RuntimeException $e) {
    Response::error($e->getMessage(), 422);
} catch (Throwable $e) {
    error_log('shop support-chat upload: ' . $e->getMessage());
    Response::error('Could not upload image.', 500);
}

Response::success($result, 201);
