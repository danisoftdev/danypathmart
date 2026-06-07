<?php

declare(strict_types=1);

use App\Helpers\OAuthService;

$provider = (string) ($_GET['provider'] ?? '');
OAuthService::handleCallback($provider, $_GET);
