<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\LegalPolicyService;
use App\Helpers\PlatformFeatures;
use App\Helpers\Response;
use App\Helpers\SizeGuideService;

$pdo = Database::pdo();

$policies = SizeGuideService::checkoutPolicies($pdo);

try {
    $trustLinks = LegalPolicyService::checkoutTrustLinks($pdo);
    $policies['checkout_trust_links'] = $trustLinks;
    $policies['checkout_legal_ready'] = count($trustLinks) >= 3;

    $returns = LegalPolicyService::findPublishedBySlug($pdo, 'returns');
    if ($returns !== null) {
        $policies['return_policy'] = 'published';
        $policies['return_policy_path'] = '/policies/returns';
    }
} catch (\Throwable) {
    $policies['checkout_trust_links'] = [];
    $policies['checkout_legal_ready'] = false;
}

$imageSearchAvailable = false;
try {
    if (class_exists(\App\Helpers\ImageSearchService::class)
        && method_exists(\App\Helpers\ImageSearchService::class, 'isAvailable')) {
        $imageSearchAvailable = \App\Helpers\ImageSearchService::isAvailable($pdo);
    }
} catch (\Throwable) {
    $imageSearchAvailable = false;
}

Response::success(array_merge(
    $policies,
    PlatformFeatures::publicFlags($pdo),
    ['image_search_available' => $imageSearchAvailable]
));
