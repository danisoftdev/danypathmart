<?php

declare(strict_types=1);

use App\Helpers\OAuthService;
use App\Helpers\Response;

Response::success(['providers' => OAuthService::enabledProviders()]);
