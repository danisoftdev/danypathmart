<?php

declare(strict_types=1);

use App\Helpers\Response;
use App\Helpers\StaffPermission;
use App\Middleware\AuthMiddleware;

AuthMiddleware::requireAdmin();

Response::success(StaffPermission::catalog());
