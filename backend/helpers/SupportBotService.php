<?php

declare(strict_types=1);

namespace App\Helpers;

use PDO;
use RuntimeException;

final class SupportBotService
{
    /** @return array<int,array<string,mixed>> */
    public static function listNodes(PDO $pdo, bool $activeOnly = true): array
    {
        $sql = 'SELECT * FROM support_bot_nodes';
        if ($activeOnly) {
            $sql .= ' WHERE is_active = 1';
        }
        $sql .= ' ORDER BY COALESCE(parent_key, \'\'), sort_order ASC, id ASC';

        return array_map(static fn (array $r): array => self::mapNode($r), $pdo->query($sql)->fetchAll());
    }

    /** @return array<int,array<string,mixed>> */
    public static function children(PDO $pdo, ?string $parentKey): array
    {
        if ($parentKey === null || $parentKey === '') {
            $parentKey = 'root';
        }
        try {
            // Top-level choices are seeded with parent_key = 'root' (not NULL).
            $stmt = $pdo->prepare(
                'SELECT * FROM support_bot_nodes WHERE parent_key <=> ? AND is_active = 1 ORDER BY sort_order ASC, id ASC'
            );
            $stmt->execute([$parentKey]);

            return array_map(static fn (array $r): array => self::mapNode($r), $stmt->fetchAll());
        } catch (\Throwable) {
            // Table missing until migration 071 — chat can still open without bot buttons.
            return [];
        }
    }

    /** @return array{messages:array<int,array<string,mixed>>,conversation:array<string,mixed>,options:array<int,array<string,mixed>>} */
    public static function handleChoice(
        PDO $pdo,
        int $conversationId,
        string $nodeKey,
        ?array $product = null
    ): array {
        $stmt = $pdo->prepare('SELECT * FROM support_bot_nodes WHERE node_key = ? AND is_active = 1 LIMIT 1');
        $stmt->execute([$nodeKey]);
        $node = $stmt->fetch();
        if ($node === false) {
            throw new RuntimeException('Unknown option.');
        }

        $messages = [];
        $action = (string) ($node['action'] ?? 'none');

        if ($action === 'answer_stock' && $product !== null) {
            $qty = (int) ($product['stock_qty'] ?? 0);
            $text = $product['is_preorder'] ?? false
                ? 'This item is available as a pre-order.'
                : ($qty > 0 ? "We currently show {$qty} in stock." : 'This item appears to be out of stock.');
            $messages[] = SupportChatService::insertBotMessage($pdo, $conversationId, $text);
        } elseif (($node['reply_text'] ?? '') !== '') {
            $messages[] = SupportChatService::insertBotMessage($pdo, $conversationId, (string) $node['reply_text']);
        }

        $conv = SupportChatService::requireConversationPublic($pdo, $conversationId);
        $routedTo = (string) ($conv['routed_to'] ?? 'pending');
        $shopId = isset($product['shop_id']) ? (int) $product['shop_id'] : (int) ($conv['shop_id'] ?? 0);

        if ($action === 'route_dpm') {
            SupportChatService::routeConversation($pdo, $conversationId, 'dpm', null);
            $routedTo = 'dpm';
        } elseif ($action === 'route_shop' && $shopId > 0) {
            SupportChatService::routeConversation($pdo, $conversationId, 'shop', $shopId);
            $routedTo = 'shop';
        }

        $pdo->prepare('UPDATE support_conversations SET bot_step_key = ? WHERE id = ?')
            ->execute([$nodeKey, $conversationId]);

        $options = $routedTo === 'pending' ? self::children($pdo, $nodeKey) : [];

        return [
            'messages'     => $messages,
            'conversation' => SupportChatService::requireConversationPublic($pdo, $conversationId),
            'options'      => $options,
        ];
    }

    /** @param array<string,mixed> $body */
    public static function upsertNode(PDO $pdo, array $body): array
    {
        $nodeKey = trim((string) ($body['node_key'] ?? ''));
        if ($nodeKey === '') {
            throw new RuntimeException('node_key required.');
        }
        $id = isset($body['id']) ? (int) $body['id'] : 0;
        $fields = [
            trim((string) ($body['parent_key'] ?? '')) ?: null,
            $nodeKey,
            trim((string) ($body['question_text'] ?? '')),
            trim((string) ($body['reply_text'] ?? '')) ?: null,
            (string) ($body['action'] ?? 'none'),
            (int) ($body['sort_order'] ?? 0),
            !empty($body['is_active']) ? 1 : 0,
        ];

        if ($id > 0) {
            $pdo->prepare(
                'UPDATE support_bot_nodes SET parent_key=?, node_key=?, question_text=?, reply_text=?, action=?, sort_order=?, is_active=? WHERE id=?'
            )->execute([...$fields, $id]);
        } else {
            $pdo->prepare(
                'INSERT INTO support_bot_nodes (parent_key, node_key, question_text, reply_text, action, sort_order, is_active) VALUES (?,?,?,?,?,?,?)'
            )->execute($fields);
            $id = (int) $pdo->lastInsertId();
        }

        $stmt = $pdo->prepare('SELECT * FROM support_bot_nodes WHERE id = ?');
        $stmt->execute([$id]);

        return self::mapNode($stmt->fetch() ?: []);
    }

    /** @param array<string,mixed> $row */
    private static function mapNode(array $row): array
    {
        return [
            'id'             => (int) $row['id'],
            'node_key'       => (string) $row['node_key'],
            'parent_key'     => $row['parent_key'],
            'question_text'  => (string) $row['question_text'],
            'reply_text'     => $row['reply_text'],
            'action'         => (string) $row['action'],
            'sort_order'     => (int) $row['sort_order'],
            'is_active'      => (int) $row['is_active'] === 1,
        ];
    }
}
