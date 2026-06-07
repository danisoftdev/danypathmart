<?php

declare(strict_types=1);

namespace App\Middleware;

use App\Config\Database;
use App\Helpers\Response;
use App\Helpers\ShopService;

/** Requires authenticated user with shop membership. */
final class ShopMiddleware
{
    /**
     * @return array{user:array<string,mixed>,shop:array<string,mixed>,shop_id:int}
     */
    public static function requireShopMember(): array
    {
        $user = AuthMiddleware::authenticate();
        $pdo = Database::pdo();
        $shopId = ShopService::userShopId($pdo, (int) $user['id']);
        if ($shopId === null) {
            Response::error('You do not have access to a shop dashboard.', 403);
        }

        $shop = ShopService::findById($pdo, $shopId);
        if ($shop === null || $shop['status'] === 'suspended') {
            Response::error('Your shop is not active.', 403);
        }

        return ['user' => $user, 'shop' => $shop, 'shop_id' => $shopId];
    }
}
