<?php

declare(strict_types=1);

namespace App\Helpers;

use PDO;
use RuntimeException;

final class SupportChatService
{
    public const GUEST_HEADER = 'HTTP_X_SUPPORT_GUEST_TOKEN';

    public static function guestTokenFromRequest(): ?string
    {
        $raw = trim((string) ($_SERVER[self::GUEST_HEADER] ?? ''));
        if ($raw === '' || strlen($raw) > 64 || !preg_match('/^[a-zA-Z0-9_-]+$/', $raw)) {
            return null;
        }

        return $raw;
    }

    /** @return array<string,mixed>|null */
    public static function findOpenForUser(PDO $pdo, int $userId): ?array
    {
        $stmt = $pdo->prepare(
            "SELECT * FROM support_conversations
             WHERE user_id = ? AND status = 'open'
             ORDER BY id DESC LIMIT 1"
        );
        $stmt->execute([$userId]);
        $row = $stmt->fetch();

        return $row !== false ? self::mapConversation($row) : null;
    }

    /** @return array<string,mixed>|null */
    public static function findByGuestToken(PDO $pdo, string $guestToken): ?array
    {
        $stmt = $pdo->prepare('SELECT * FROM support_conversations WHERE guest_token = ? LIMIT 1');
        $stmt->execute([$guestToken]);
        $row = $stmt->fetch();

        return $row !== false ? self::mapConversation($row) : null;
    }

    /** @return array<string,mixed> */
    public static function startWithContext(
        PDO $pdo,
        ?array $user,
        ?string $guestToken,
        string $name,
        string $email,
        ?int $productId = null,
        ?int $orderId = null
    ): array {
        $product = null;
        $shopId = null;
        if ($productId !== null && $productId > 0) {
            $stmt = $pdo->prepare(
                'SELECT id, name, stock_qty, is_preorder, shop_id FROM products WHERE id = ? AND status = ? LIMIT 1'
            );
            $stmt->execute([$productId, 'active']);
            $product = $stmt->fetch() ?: null;
            if ($product !== false && $product !== null) {
                $shopId = $product['shop_id'] !== null ? (int) $product['shop_id'] : null;
            }
        }

        if ($user !== null) {
            $existing = self::findOpenForUser($pdo, (int) $user['id']);
            if ($existing !== null) {
                self::attachContext($pdo, (int) $existing['id'], $productId, $shopId, $orderId);
                return self::requireConversationPublic($pdo, (int) $existing['id']);
            }
            self::insertOpenConversation(
                $pdo,
                (int) $user['id'],
                null,
                $name,
                $email,
                $productId,
                $shopId,
                $orderId
            );
        } else {
            if ($guestToken === null) {
                throw new RuntimeException('Guest token required.');
            }
            $existing = self::findByGuestToken($pdo, $guestToken);
            if ($existing !== null && ($existing['status'] ?? '') === 'open') {
                self::attachContext($pdo, (int) $existing['id'], $productId, $shopId, $orderId);
                return self::requireConversationPublic($pdo, (int) $existing['id']);
            }
            self::insertOpenConversation(
                $pdo,
                null,
                $guestToken,
                $name,
                $email,
                $productId,
                $shopId,
                $orderId
            );
        }

        $conv = self::requireConversationPublic($pdo, (int) $pdo->lastInsertId());
        $intro = $productId !== null && $product !== false && $product !== null
            ? 'Hi! You asked about: ' . ($product['name'] ?? 'this product') . '. Is this about Danypath Mart, or a shop?'
            : 'Hi! How can we help you today? Is this about Danypath Mart, or a shop?';
        try {
            self::insertSystemMessage($pdo, (int) $conv['id'], $intro);
        } catch (\Throwable $e) {
            try {
                self::insertBotMessage($pdo, (int) $conv['id'], $intro);
            } catch (\Throwable $e2) {
                error_log('support intro message: ' . $e2->getMessage());
            }
        }

        return $conv;
    }

    private static function insertOpenConversation(
        PDO $pdo,
        ?int $userId,
        ?string $guestToken,
        string $name,
        string $email,
        ?int $productId,
        ?int $shopId,
        ?int $orderId
    ): void {
        $context = $productId !== null ? 'product' : ($orderId !== null ? 'order' : 'general');
        try {
            if ($userId !== null) {
                $pdo->prepare(
                    'INSERT INTO support_conversations (user_id, guest_name, guest_email, product_id, shop_id, order_id, context_type, status)
                     VALUES (?, ?, ?, ?, ?, ?, ?, \'open\')'
                )->execute([$userId, $name, $email, $productId, $shopId, $orderId, $context]);
            } else {
                $pdo->prepare(
                    'INSERT INTO support_conversations (guest_token, guest_name, guest_email, product_id, shop_id, order_id, context_type, status)
                     VALUES (?, ?, ?, ?, ?, ?, ?, \'open\')'
                )->execute([$guestToken, $name, $email, $productId, $shopId, $orderId, $context]);
            }
        } catch (\Throwable) {
            // Fallback when context columns from migration 055/071 are not present yet.
            if ($userId !== null) {
                $pdo->prepare(
                    'INSERT INTO support_conversations (user_id, guest_name, guest_email, status)
                     VALUES (?, ?, ?, \'open\')'
                )->execute([$userId, $name, $email]);
            } else {
                $pdo->prepare(
                    'INSERT INTO support_conversations (guest_token, guest_name, guest_email, status)
                     VALUES (?, ?, ?, \'open\')'
                )->execute([$guestToken, $name, $email]);
            }
        }
    }

    public static function attachContext(PDO $pdo, int $conversationId, ?int $productId, ?int $shopId, ?int $orderId): void
    {
        $pdo->prepare(
            'UPDATE support_conversations SET product_id = COALESCE(?, product_id), shop_id = COALESCE(?, shop_id),
                order_id = COALESCE(?, order_id), updated_at = NOW() WHERE id = ?'
        )->execute([$productId, $shopId, $orderId, $conversationId]);
    }

    public static function routeConversation(PDO $pdo, int $conversationId, string $routedTo, ?int $shopId): void
    {
        if (!in_array($routedTo, ['dpm', 'shop'], true)) {
            return;
        }
        if ($routedTo === 'shop') {
            $pdo->prepare(
                'UPDATE support_conversations SET routed_to = ?, shop_id = ?, updated_at = NOW() WHERE id = ?'
            )->execute([$routedTo, $shopId, $conversationId]);
            return;
        }
        $pdo->prepare(
            'UPDATE support_conversations SET routed_to = ?, shop_id = COALESCE(?, shop_id), updated_at = NOW() WHERE id = ?'
        )->execute([$routedTo, $shopId, $conversationId]);
    }

    /**
     * Route an open conversation to DPM or a shop (customer-driven).
     *
     * @return array{conversation:array<string,mixed>,message:array<string,mixed>}
     */
    public static function routeCustomerChat(PDO $pdo, int $conversationId, string $route, ?int $shopId = null): array
    {
        $conv = self::requireConversation($pdo, $conversationId);
        if (($conv['status'] ?? '') !== 'open') {
            throw new RuntimeException('This chat is closed.');
        }
        if (($conv['routed_to'] ?? 'pending') !== 'pending') {
            throw new RuntimeException('This chat is already connected.');
        }

        if ($route === 'dpm') {
            self::routeConversation($pdo, $conversationId, 'dpm', null);
            $pdo->prepare(
                'UPDATE support_conversations SET dpm_joined_at = COALESCE(dpm_joined_at, NOW()), updated_at = NOW() WHERE id = ?'
            )->execute([$conversationId]);
            $msg = self::insertSystemMessage(
                $pdo,
                $conversationId,
                "You're chatting with Danypath Mart support. Send a message or photo — we'll reply here."
            );

            return [
                'conversation' => self::requireConversation($pdo, $conversationId),
                'message'      => $msg,
            ];
        }

        if ($route !== 'shop') {
            throw new RuntimeException('Choose Danypath Mart or a shop.');
        }
        if ($shopId === null || $shopId <= 0) {
            throw new RuntimeException('Please choose a shop.');
        }

        $shopStmt = $pdo->prepare(
            "SELECT id, name FROM shops WHERE id = ? AND status = 'active' LIMIT 1"
        );
        $shopStmt->execute([$shopId]);
        $shop = $shopStmt->fetch();
        if ($shop === false) {
            throw new RuntimeException('That shop was not found.');
        }

        self::routeConversation($pdo, $conversationId, 'shop', (int) $shop['id']);
        $shopName = (string) $shop['name'];
        $msg = self::insertSystemMessage(
            $pdo,
            $conversationId,
            "You're chatting with {$shopName}. Send a message or photo — they'll reply here. Danypath Mart can step in if needed."
        );

        return [
            'conversation' => self::requireConversation($pdo, $conversationId),
            'message'      => $msg,
        ];
    }

    /**
     * DPM joins a shop (or pending) chat so they can reply. Shop chats stay shop-routed.
     *
     * @return array{conversation:array<string,mixed>,message:array<string,mixed>}
     */
    public static function adminJoinChat(PDO $pdo, int $conversationId): array
    {
        $conv = self::requireConversation($pdo, $conversationId);
        if (!empty($conv['dpm_joined_at']) || ($conv['routed_to'] ?? '') === 'dpm') {
            return [
                'conversation' => $conv,
                'message'      => null,
            ];
        }

        $pdo->prepare(
            'UPDATE support_conversations SET dpm_joined_at = NOW(), updated_at = NOW() WHERE id = ?'
        )->execute([$conversationId]);

        $msg = self::insertSystemMessage($pdo, $conversationId, 'DPM Support joined the chat.');

        return [
            'conversation' => self::requireConversation($pdo, $conversationId),
            'message'      => $msg,
        ];
    }

    public static function adminCanReply(array $conversation): bool
    {
        $routed = (string) ($conversation['routed_to'] ?? 'pending');
        if ($routed === 'dpm' || $routed === 'pending') {
            return true;
        }
        if ($routed === 'shop') {
            return !empty($conversation['dpm_joined_at']);
        }

        return false;
    }

    /** @return array<string,mixed> */
    public static function insertBotMessage(PDO $pdo, int $conversationId, string $body): array
    {
        self::insertMessage($pdo, $conversationId, 'bot', null, $body, null);
        $pdo->prepare(
            'UPDATE support_conversations SET last_message_at = NOW(), customer_unread_count = customer_unread_count + 1, updated_at = NOW() WHERE id = ?'
        )->execute([$conversationId]);

        return self::mapMessage(self::fetchMessage($pdo, (int) $pdo->lastInsertId()));
    }

    /** @return array<string,mixed> */
    public static function insertSystemMessage(PDO $pdo, int $conversationId, string $body): array
    {
        try {
            self::insertMessage($pdo, $conversationId, 'system', null, $body, null);
        } catch (\Throwable) {
            return self::insertBotMessage($pdo, $conversationId, $body);
        }
        $pdo->prepare(
            'UPDATE support_conversations SET last_message_at = NOW(), customer_unread_count = customer_unread_count + 1, updated_at = NOW() WHERE id = ?'
        )->execute([$conversationId]);

        return self::mapMessage(self::fetchMessage($pdo, (int) $pdo->lastInsertId()));
    }

    /** @return array<int,array<string,mixed>> */
    public static function listForShop(PDO $pdo, int $shopId, ?string $status = 'open'): array
    {
        $sql = 'SELECT c.* FROM support_conversations c WHERE c.routed_to = \'shop\' AND c.shop_id = ?';
        $params = [$shopId];
        if ($status === 'open' || $status === 'closed') {
            $sql .= ' AND c.status = ?';
            $params[] = $status;
        }
        $sql .= ' ORDER BY COALESCE(c.last_message_at, c.created_at) DESC LIMIT 100';
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);

        return array_map(static fn (array $r): array => self::mapConversation($r), $stmt->fetchAll());
    }

    /** @return array<string,mixed> */
    public static function sendShopMessage(
        PDO $pdo,
        int $conversationId,
        int $shopUserId,
        ?string $body,
        ?string $imageUrl = null
    ): array {
        $conv = self::requireConversation($pdo, $conversationId);
        if (($conv['routed_to'] ?? '') !== 'shop') {
            throw new RuntimeException('This chat is not assigned to a shop.');
        }
        self::insertMessage($pdo, $conversationId, 'shop', $shopUserId, $body, $imageUrl);
        $pdo->prepare(
            'UPDATE support_conversations SET customer_unread_count = customer_unread_count + 1,
                shop_unread_count = 0, last_message_at = NOW(), updated_at = NOW() WHERE id = ?'
        )->execute([$conversationId]);

        return self::mapMessage(self::fetchMessage($pdo, (int) $pdo->lastInsertId()));
    }

    public static function markShopRead(PDO $pdo, int $conversationId): void
    {
        $pdo->prepare(
            'UPDATE support_conversations SET shop_unread_count = 0, updated_at = NOW() WHERE id = ?'
        )->execute([$conversationId]);
    }

    /** @return array<string,mixed> */
    public static function createForUser(PDO $pdo, int $userId, string $name, string $email): array
    {
        $pdo->prepare(
            'INSERT INTO support_conversations (user_id, guest_name, guest_email, status)
             VALUES (?, ?, ?, \'open\')'
        )->execute([$userId, $name, $email]);

        return self::requireConversation($pdo, (int) $pdo->lastInsertId());
    }

    /** @return array<string,mixed> */
    public static function createForGuest(PDO $pdo, string $guestToken, string $name, string $email): array
    {
        $pdo->prepare(
            'INSERT INTO support_conversations (guest_token, guest_name, guest_email, status)
             VALUES (?, ?, ?, \'open\')'
        )->execute([$guestToken, $name, $email]);

        return self::requireConversation($pdo, (int) $pdo->lastInsertId());
    }

    /** @return array<string,mixed> */
    public static function startGuest(PDO $pdo, string $guestToken, string $name, string $email): array
    {
        $existing = self::findByGuestToken($pdo, $guestToken);
        if ($existing !== null) {
            if (($existing['status'] ?? '') === 'closed') {
                $pdo->prepare(
                    "UPDATE support_conversations
                     SET guest_name = ?, guest_email = ?, status = 'open', updated_at = NOW()
                     WHERE id = ?"
                )->execute([$name, $email, (int) $existing['id']]);

                return self::requireConversation($pdo, (int) $existing['id']);
            }

            $pdo->prepare(
                'UPDATE support_conversations SET guest_name = ?, guest_email = ?, updated_at = NOW() WHERE id = ?'
            )->execute([$name, $email, (int) $existing['id']]);

            return self::requireConversation($pdo, (int) $existing['id']);
        }

        return self::createForGuest($pdo, $guestToken, $name, $email);
    }

    /**
     * @param array<string,mixed>|null $user
     * @return array{conversation:array<string,mixed>,messages:array<int,array<string,mixed>>}
     */
    public static function loadCustomerThread(PDO $pdo, ?array $user, ?string $guestToken, ?int $sinceMessageId = null): array
    {
        $conversation = null;

        if ($user !== null) {
            $conversation = self::findOpenForUser($pdo, (int) $user['id']);
        } elseif ($guestToken !== null) {
            $conversation = self::findByGuestToken($pdo, $guestToken);
            if ($conversation !== null && ($conversation['status'] ?? '') === 'closed') {
                $conversation = null;
            }
        }

        if ($conversation === null) {
            return ['conversation' => null, 'messages' => []];
        }

        self::markCustomerRead($pdo, (int) $conversation['id']);

        return [
            'conversation' => self::requireConversation($pdo, (int) $conversation['id']),
            'messages'     => self::listMessages($pdo, (int) $conversation['id'], $sinceMessageId),
        ];
    }

    /** @return array<int,array<string,mixed>> */
    public static function listMessages(PDO $pdo, int $conversationId, ?int $sinceMessageId = null): array
    {
        if ($sinceMessageId !== null && $sinceMessageId > 0) {
            $stmt = $pdo->prepare(
                'SELECT m.*, u.name AS sender_name
                 FROM support_messages m
                 LEFT JOIN users u ON u.id = m.sender_user_id
                 WHERE m.conversation_id = ? AND m.id > ?
                 ORDER BY m.id ASC
                 LIMIT 200'
            );
            $stmt->execute([$conversationId, $sinceMessageId]);
        } else {
            $stmt = $pdo->prepare(
                'SELECT m.*, u.name AS sender_name
                 FROM support_messages m
                 LEFT JOIN users u ON u.id = m.sender_user_id
                 WHERE m.conversation_id = ?
                 ORDER BY m.id ASC
                 LIMIT 200'
            );
            $stmt->execute([$conversationId]);
        }

        return array_map(static fn (array $r): array => self::mapMessage($r), $stmt->fetchAll());
    }

    /**
     * @param array<string,mixed>|null $user
     * @return array<string,mixed>
     */
    public static function sendCustomerMessage(
        PDO $pdo,
        ?array $user,
        ?string $guestToken,
        ?string $body,
        ?string $imageUrl
    ): array {
        $conversation = self::resolveCustomerConversation($pdo, $user, $guestToken);
        $conversationId = (int) $conversation['id'];

        self::insertMessage($pdo, $conversationId, 'customer', $user !== null ? (int) $user['id'] : null, $body, $imageUrl);

        $routedTo = (string) ($conversation['routed_to'] ?? 'pending');
        if ($routedTo === 'shop') {
            $pdo->prepare(
                'UPDATE support_conversations
                 SET admin_unread_count = admin_unread_count + 1,
                     shop_unread_count = shop_unread_count + 1,
                     last_message_at = NOW(),
                     updated_at = NOW()
                 WHERE id = ?'
            )->execute([$conversationId]);
        } else {
            $pdo->prepare(
                'UPDATE support_conversations
                 SET admin_unread_count = admin_unread_count + 1,
                     last_message_at = NOW(),
                     updated_at = NOW()
                 WHERE id = ?'
            )->execute([$conversationId]);

            $preview = self::messagePreview($body, $imageUrl);
            $who = (string) ($conversation['guest_name'] ?? 'Customer');
            NotificationService::notifyAdmins(
                $pdo,
                'Live chat — ' . $who,
                $preview,
                '/admin/support-chat?c=' . $conversationId,
                'admin_support_chat'
            );
        }

        return self::mapMessage(self::fetchMessage($pdo, (int) $pdo->lastInsertId()));
    }

    /** @return array<string,mixed> */
    public static function sendAdminMessage(
        PDO $pdo,
        int $conversationId,
        int $adminUserId,
        ?string $body,
        ?string $imageUrl
    ): array {
        $conv = self::requireConversation($pdo, $conversationId);
        if (!self::adminCanReply($conv)) {
            throw new RuntimeException('Join this chat before replying. You can watch silently until then.');
        }
        self::insertMessage($pdo, $conversationId, 'admin', $adminUserId, $body, $imageUrl);

        $pdo->prepare(
            'UPDATE support_conversations
             SET customer_unread_count = customer_unread_count + 1,
                 admin_unread_count = 0,
                 dpm_joined_at = COALESCE(dpm_joined_at, NOW()),
                 last_message_at = NOW(),
                 updated_at = NOW()
             WHERE id = ?'
        )->execute([$conversationId]);

        return self::mapMessage(self::fetchMessage($pdo, (int) $pdo->lastInsertId()));
    }

    /** @return array<int,array<string,mixed>> */
    public static function listForAdmin(PDO $pdo, ?string $status = null, ?string $routedTo = null): array
    {
        $sql = 'SELECT c.*,
                       s.name AS shop_name,
                       (SELECT body FROM support_messages m WHERE m.conversation_id = c.id ORDER BY m.id DESC LIMIT 1) AS last_body,
                       (SELECT image_url FROM support_messages m WHERE m.conversation_id = c.id ORDER BY m.id DESC LIMIT 1) AS last_image_url
                FROM support_conversations c
                LEFT JOIN shops s ON s.id = c.shop_id
                WHERE 1=1';
        $params = [];
        if ($status === 'open' || $status === 'closed') {
            $sql .= ' AND c.status = ?';
            $params[] = $status;
        }
        if ($routedTo !== null && $routedTo !== '' && $routedTo !== 'all') {
            $sql .= ' AND c.routed_to = ?';
            $params[] = $routedTo;
        }
        $sql .= ' ORDER BY COALESCE(c.last_message_at, c.created_at) DESC LIMIT 200';

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);

        return array_map(static function (array $r): array {
            $conv = self::mapConversation($r);
            $conv['shop_name'] = isset($r['shop_name']) && $r['shop_name'] !== null ? (string) $r['shop_name'] : null;
            $conv['last_preview'] = self::messagePreview(
                isset($r['last_body']) ? (string) $r['last_body'] : null,
                isset($r['last_image_url']) ? (string) $r['last_image_url'] : null
            );

            return $conv;
        }, $stmt->fetchAll());
    }

    public static function unreadAdminCount(PDO $pdo): int
    {
        return (int) $pdo->query(
            "SELECT COALESCE(SUM(admin_unread_count), 0) FROM support_conversations WHERE status = 'open'"
        )->fetchColumn();
    }

    public static function markAdminRead(PDO $pdo, int $conversationId): void
    {
        $pdo->prepare(
            'UPDATE support_conversations SET admin_unread_count = 0, updated_at = NOW() WHERE id = ?'
        )->execute([$conversationId]);
    }

    public static function markCustomerRead(PDO $pdo, int $conversationId): void
    {
        $pdo->prepare(
            'UPDATE support_conversations SET customer_unread_count = 0, updated_at = NOW() WHERE id = ?'
        )->execute([$conversationId]);
    }

    /** @return array{url:string} */
    public static function storeUploadedImage(array $file): array
    {
        if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
            throw new RuntimeException('No image uploaded.');
        }
        if ((int) $file['size'] > 5 * 1024 * 1024) {
            throw new RuntimeException('Image must be 5MB or smaller.');
        }

        $allowed = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];
        $finfo = new \finfo(FILEINFO_MIME_TYPE);
        $mime = (string) $finfo->file($file['tmp_name']);
        if (!isset($allowed[$mime])) {
            throw new RuntimeException('Only JPEG, PNG or WebP images are allowed.');
        }

        $backendDir = dirname(__DIR__);
        $dir = $backendDir . '/uploads/support-chat';
        if (!is_dir($dir)) {
            @mkdir($dir, 0775, true);
        }

        $filename = bin2hex(random_bytes(16)) . '.' . $allowed[$mime];
        $absPath = $dir . '/' . $filename;
        if (!move_uploaded_file($file['tmp_name'], $absPath)) {
            throw new RuntimeException('Could not store the uploaded image.');
        }

        return ['url' => '/uploads/support-chat/' . $filename];
    }

    public static function assertCustomerAccess(?array $user, ?string $guestToken, array $conversation): void
    {
        if ($user !== null && (int) ($conversation['user_id'] ?? 0) === (int) $user['id']) {
            return;
        }
        if ($guestToken !== null
            && ($conversation['guest_token'] ?? '') !== ''
            && hash_equals((string) $conversation['guest_token'], $guestToken)) {
            return;
        }

        throw new RuntimeException('Conversation not found.');
    }

    /** @param array<string,mixed>|null $user */
    private static function resolveCustomerConversation(PDO $pdo, ?array $user, ?string $guestToken): array
    {
        if ($user !== null) {
            $conversation = self::findOpenForUser($pdo, (int) $user['id']);
            if ($conversation === null) {
                throw new RuntimeException('Start a chat before sending a message.');
            }

            return $conversation;
        }

        if ($guestToken === null) {
            throw new RuntimeException('Guest token required.');
        }

        $conversation = self::findByGuestToken($pdo, $guestToken);
        if ($conversation === null || ($conversation['status'] ?? '') !== 'open') {
            throw new RuntimeException('Start a chat before sending a message.');
        }

        return $conversation;
    }

    private static function insertMessage(
        PDO $pdo,
        int $conversationId,
        string $senderType,
        ?int $senderUserId,
        ?string $body,
        ?string $imageUrl
    ): void {
        $body = $body !== null ? trim($body) : null;
        $imageUrl = $imageUrl !== null ? trim($imageUrl) : null;
        if (($body === null || $body === '') && ($imageUrl === null || $imageUrl === '')) {
            throw new RuntimeException('Message text or image is required.');
        }
        if ($body !== null && strlen($body) > 5000) {
            throw new RuntimeException('Message is too long (max 5000 characters).');
        }

        $pdo->prepare(
            'INSERT INTO support_messages (conversation_id, sender_type, sender_user_id, body, image_url)
             VALUES (?, ?, ?, ?, ?)'
        )->execute([
            $conversationId,
            $senderType,
            $senderUserId,
            $body !== '' ? $body : null,
            $imageUrl !== '' ? $imageUrl : null,
        ]);
    }

    /** @return array<string,mixed> */
    public static function requireConversationPublic(PDO $pdo, int $id): array
    {
        return self::requireConversation($pdo, $id);
    }

    /** @return array<string,mixed> */
    private static function requireConversation(PDO $pdo, int $id): array
    {
        $stmt = $pdo->prepare(
            'SELECT c.*, s.name AS shop_name
             FROM support_conversations c
             LEFT JOIN shops s ON s.id = c.shop_id
             WHERE c.id = ?
             LIMIT 1'
        );
        $stmt->execute([$id]);
        $row = $stmt->fetch();
        if ($row === false) {
            throw new RuntimeException('Conversation not found.');
        }

        return self::mapConversation($row);
    }

    /** @return array<string,mixed> */
    private static function fetchMessage(PDO $pdo, int $id): array
    {
        $stmt = $pdo->prepare(
            'SELECT m.*, u.name AS sender_name
             FROM support_messages m
             LEFT JOIN users u ON u.id = m.sender_user_id
             WHERE m.id = ? LIMIT 1'
        );
        $stmt->execute([$id]);
        $row = $stmt->fetch();
        if ($row === false) {
            throw new RuntimeException('Message not found.');
        }

        return $row;
    }

    /** @param array<string,mixed> $row */
    private static function mapConversation(array $row): array
    {
        return [
            'id'                      => (int) $row['id'],
            'user_id'                 => $row['user_id'] !== null ? (int) $row['user_id'] : null,
            'guest_token'             => $row['guest_token'] !== null ? (string) $row['guest_token'] : null,
            'guest_name'              => $row['guest_name'] !== null ? (string) $row['guest_name'] : null,
            'guest_email'             => $row['guest_email'] !== null ? (string) $row['guest_email'] : null,
            'product_id'              => isset($row['product_id']) && $row['product_id'] !== null ? (int) $row['product_id'] : null,
            'shop_id'                 => isset($row['shop_id']) && $row['shop_id'] !== null ? (int) $row['shop_id'] : null,
            'order_id'                => isset($row['order_id']) && $row['order_id'] !== null ? (int) $row['order_id'] : null,
            'context_type'            => (string) ($row['context_type'] ?? 'general'),
            'routed_to'               => (string) ($row['routed_to'] ?? 'pending'),
            'bot_step_key'            => $row['bot_step_key'] ?? null,
            'dpm_joined_at'           => $row['dpm_joined_at'] ?? null,
            'dpm_joined'              => !empty($row['dpm_joined_at']) || (string) ($row['routed_to'] ?? '') === 'dpm',
            'shop_name'               => isset($row['shop_name']) && $row['shop_name'] !== null ? (string) $row['shop_name'] : null,
            'status'                  => (string) $row['status'],
            'admin_unread_count'      => (int) ($row['admin_unread_count'] ?? 0),
            'shop_unread_count'       => (int) ($row['shop_unread_count'] ?? 0),
            'customer_unread_count'   => (int) ($row['customer_unread_count'] ?? 0),
            'last_message_at'         => $row['last_message_at'],
            'created_at'              => $row['created_at'],
            'updated_at'              => $row['updated_at'],
        ];
    }

    /** @param array<string,mixed> $row */
    private static function mapMessage(array $row): array
    {
        return [
            'id'              => (int) $row['id'],
            'conversation_id' => (int) $row['conversation_id'],
            'sender_type'     => (string) $row['sender_type'],
            'sender_user_id'  => $row['sender_user_id'] !== null ? (int) $row['sender_user_id'] : null,
            'sender_name'     => $row['sender_name'] !== null ? (string) $row['sender_name'] : null,
            'body'            => $row['body'] !== null ? (string) $row['body'] : null,
            'image_url'       => $row['image_url'] !== null ? (string) $row['image_url'] : null,
            'created_at'      => (string) $row['created_at'],
        ];
    }

    private static function messagePreview(?string $body, ?string $imageUrl): string
    {
        $text = trim((string) $body);
        if ($text !== '') {
            return strlen($text) > 120 ? substr($text, 0, 117) . '...' : $text;
        }
        if ($imageUrl !== null && $imageUrl !== '') {
            return '[Image]';
        }

        return '[Message]';
    }
}
