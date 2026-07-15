-- Ensure live-chat bot schema exists (idempotent).
-- Fixes "Could not start chat" when migration 055 only partially applied.

-- Conversation context columns
SET @s = (SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'support_conversations' AND COLUMN_NAME = 'product_id'),
    'SELECT ''skip support_conversations.product_id'' AS info',
    'ALTER TABLE support_conversations ADD COLUMN product_id BIGINT UNSIGNED DEFAULT NULL AFTER guest_email'
));
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @s = (SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'support_conversations' AND COLUMN_NAME = 'shop_id'),
    'SELECT ''skip support_conversations.shop_id'' AS info',
    'ALTER TABLE support_conversations ADD COLUMN shop_id BIGINT UNSIGNED DEFAULT NULL AFTER product_id'
));
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @s = (SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'support_conversations' AND COLUMN_NAME = 'order_id'),
    'SELECT ''skip support_conversations.order_id'' AS info',
    'ALTER TABLE support_conversations ADD COLUMN order_id BIGINT UNSIGNED DEFAULT NULL AFTER shop_id'
));
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @s = (SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'support_conversations' AND COLUMN_NAME = 'context_type'),
    'SELECT ''skip support_conversations.context_type'' AS info',
    'ALTER TABLE support_conversations ADD COLUMN context_type ENUM(''general'',''product'',''order'') NOT NULL DEFAULT ''general'' AFTER order_id'
));
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @s = (SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'support_conversations' AND COLUMN_NAME = 'routed_to'),
    'SELECT ''skip support_conversations.routed_to'' AS info',
    'ALTER TABLE support_conversations ADD COLUMN routed_to ENUM(''pending'',''dpm'',''shop'') NOT NULL DEFAULT ''pending'' AFTER context_type'
));
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @s = (SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'support_conversations' AND COLUMN_NAME = 'bot_step_key'),
    'SELECT ''skip support_conversations.bot_step_key'' AS info',
    'ALTER TABLE support_conversations ADD COLUMN bot_step_key VARCHAR(80) DEFAULT NULL AFTER routed_to'
));
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @s = (SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'support_conversations' AND COLUMN_NAME = 'shop_unread_count'),
    'SELECT ''skip support_conversations.shop_unread_count'' AS info',
    'ALTER TABLE support_conversations ADD COLUMN shop_unread_count INT UNSIGNED NOT NULL DEFAULT 0 AFTER admin_unread_count'
));
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Allow bot/shop sender types
SET @s = (SELECT IF(
    EXISTS(
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'support_messages' AND COLUMN_NAME = 'sender_type'
          AND COLUMN_TYPE LIKE '%bot%'
    ),
    'SELECT ''skip support_messages.sender_type'' AS info',
    'ALTER TABLE support_messages MODIFY COLUMN sender_type ENUM(''customer'',''admin'',''bot'',''shop'') NOT NULL'
));
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS support_bot_nodes (
    id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    node_key       VARCHAR(80)     NOT NULL,
    parent_key     VARCHAR(80)     DEFAULT NULL,
    question_text  VARCHAR(500)    NOT NULL,
    reply_text     TEXT            DEFAULT NULL,
    action         ENUM('none','route_dpm','route_shop','answer_stock','answer_product','end') NOT NULL DEFAULT 'none',
    sort_order     INT             NOT NULL DEFAULT 0,
    is_active      TINYINT(1)      NOT NULL DEFAULT 1,
    created_at     TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_support_bot_node_key (node_key),
    KEY idx_support_bot_parent (parent_key, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO support_bot_nodes (node_key, parent_key, question_text, reply_text, action, sort_order) VALUES
('root', NULL, 'What do you need help with?', NULL, 'none', 0),
('product_help', 'root', 'Question about this product', NULL, 'none', 10),
('order_help', 'root', 'Order or delivery', 'We can help with orders and delivery. A DanyPathMart team member will assist you shortly.', 'route_dpm', 20),
('payment_help', 'root', 'Payment or refund', 'Payment and refund questions are handled by DanyPathMart support.', 'route_dpm', 30),
('general_other', 'root', 'Something else', 'Thanks — a support agent will join this chat soon.', 'route_dpm', 40),
('stock_check', 'product_help', 'Is this item in stock?', NULL, 'answer_stock', 10),
('product_seller', 'product_help', 'Ask the seller a question', 'Connecting you with the shop seller for this product.', 'route_shop', 20),
('product_dpm', 'product_help', 'Ask DanyPathMart about this item', 'A DanyPathMart team member will help with this product.', 'route_dpm', 30);
