<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;

$user = AuthMiddleware::authenticate();
$pdo = Database::pdo();
$body = Response::body();

$currency = strtoupper(trim((string) ($body['currency'] ?? '')));

// Must be a configured display currency.
$stmt = $pdo->prepare('SELECT 1 FROM currency_rates WHERE currency_code = ?');
$stmt->execute([$currency]);
if ($stmt->fetchColumn() === false) {
    Response::error('Unsupported currency.', 422, ['code' => 'bad_currency']);
}

$pdo->prepare('UPDATE users SET preferred_currency = ? WHERE id = ?')
    ->execute([$currency, (int) $user['id']]);

Response::success(['message' => 'Currency preference saved.', 'preferred_currency' => $currency]);
