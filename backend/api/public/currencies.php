<?php

declare(strict_types=1);

use App\Helpers\Response;

Response::success([
    'data' => [
        [
            'code'        => 'GHS',
            'name'        => 'Ghana Cedi',
            'rate_to_ghs' => 1.0,
        ],
    ],
]);
