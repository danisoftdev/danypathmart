<?php



declare(strict_types=1);



use App\Config\Database;

use App\Helpers\CareerService;

use App\Helpers\Response;

use App\Middleware\AuthMiddleware;

use App\Middleware\PermissionMiddleware;



AuthMiddleware::requireAdmin();

PermissionMiddleware::requireAny(['manage_careers', 'view_company_settings', 'hire_employees']);



$pdo = Database::pdo();

$unreadOnly = isset($_GET['unread']) && (string) $_GET['unread'] === '1';



$sql = 'SELECT a.id, a.job_post_id, a.job_title, a.user_id, a.hired_user_id, a.hired_at,

               a.name, a.email, a.phone, a.city, a.cover_message, a.is_read, a.created_at,

               p.job_type, r.label AS job_type_label

        FROM job_applications a

        LEFT JOIN job_posts p ON p.id = a.job_post_id

        LEFT JOIN job_role_types r ON r.slug = p.job_type';

if ($unreadOnly) {

    $sql .= ' WHERE a.is_read = 0';

}

$sql .= ' ORDER BY a.created_at DESC LIMIT 200';



$rows = $pdo->query($sql)->fetchAll();



$unread = (int) $pdo->query('SELECT COUNT(*) FROM job_applications WHERE is_read = 0')->fetchColumn();



$data = array_map(static function (array $r) use ($pdo): array {

    $jobType = (string) ($r['job_type'] ?? '');



    return [

        'id'             => (int) $r['id'],

        'job_post_id'    => $r['job_post_id'] !== null ? (int) $r['job_post_id'] : null,

        'job_title'      => $r['job_title'],

        'job_type'       => $jobType !== '' ? $jobType : null,

        'job_type_label' => $r['job_type_label'] ?? ($jobType !== '' ? CareerService::jobTypeLabel($pdo, $jobType) : null),

        'user_id'        => $r['user_id'] !== null ? (int) $r['user_id'] : null,

        'hired_user_id'  => isset($r['hired_user_id']) && $r['hired_user_id'] !== null ? (int) $r['hired_user_id'] : null,

        'hired_at'       => $r['hired_at'] ?? null,

        'is_hired'       => !empty($r['hired_user_id']),

        'name'           => $r['name'],

        'email'          => $r['email'],

        'phone'          => $r['phone'],

        'city'           => $r['city'],

        'cover_message'  => $r['cover_message'],

        'is_read'        => (bool) $r['is_read'],

        'created_at'     => $r['created_at'],

    ];

}, $rows);



Response::success(['data' => $data, 'unread_count' => $unread]);

