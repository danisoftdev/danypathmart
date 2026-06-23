-- Trust & messaging: reviews, stock on payment, shop search, support bot routing, push/SMS/WhatsApp toggles.
-- Idempotent: safe to re-run in phpMyAdmin or via php scripts/migrate-production.php

-- products.units_sold
SET @s = (SELECT IF(
    EXISTS(
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND COLUMN_NAME = 'units_sold'
    ),
    'SELECT ''skip products.units_sold'' AS info',
    'ALTER TABLE products ADD COLUMN units_sold INT UNSIGNED NOT NULL DEFAULT 0 AFTER stock_qty'
));
PREPARE stmt FROM @s;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- shops.rating_avg
SET @s = (SELECT IF(
    EXISTS(
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'shops' AND COLUMN_NAME = 'rating_avg'
    ),
    'SELECT ''skip shops.rating_avg'' AS info',
    'ALTER TABLE shops ADD COLUMN rating_avg DECIMAL(2,1) DEFAULT NULL AFTER logo_url'
));
PREPARE stmt FROM @s;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- shops.rating_count
SET @s = (SELECT IF(
    EXISTS(
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'shops' AND COLUMN_NAME = 'rating_count'
    ),
    'SELECT ''skip shops.rating_count'' AS info',
    'ALTER TABLE shops ADD COLUMN rating_count INT UNSIGNED NOT NULL DEFAULT 0 AFTER rating_avg'
));
PREPARE stmt FROM @s;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- orders.notify_whatsapp (Phase F — may be missing if only numbered SQL migrations were applied)
SET @s = (SELECT IF(
    EXISTS(
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'notify_whatsapp'
    ),
    'SELECT ''skip orders.notify_whatsapp'' AS info',
    'ALTER TABLE orders ADD COLUMN notify_whatsapp TINYINT(1) NOT NULL DEFAULT 0 AFTER notes'
));
PREPARE stmt FROM @s;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- orders.inventory_committed (AFTER anchor chosen from columns that exist on this database)
SET @after_col = IF(
    EXISTS(
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'notify_whatsapp'
    ),
    'notify_whatsapp',
    IF(
        EXISTS(
            SELECT 1 FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'organization_name'
        ),
        'organization_name',
        IF(
            EXISTS(
                SELECT 1 FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'order_type'
            ),
            'order_type',
            'notes'
        )
    )
);
SET @s = (SELECT IF(
    EXISTS(
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'inventory_committed'
    ),
    'SELECT ''skip orders.inventory_committed'' AS info',
    CONCAT('ALTER TABLE orders ADD COLUMN inventory_committed TINYINT(1) NOT NULL DEFAULT 0 AFTER ', @after_col)
));
PREPARE stmt FROM @s;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- company_settings.stock_decrement_on_payment
SET @s = (SELECT IF(
    EXISTS(
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'company_settings' AND COLUMN_NAME = 'stock_decrement_on_payment'
    ),
    'SELECT ''skip company_settings.stock_decrement_on_payment'' AS info',
    'ALTER TABLE company_settings ADD COLUMN stock_decrement_on_payment TINYINT(1) NOT NULL DEFAULT 1'
));
PREPARE stmt FROM @s;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- company_settings.show_units_sold_badge
SET @s = (SELECT IF(
    EXISTS(
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'company_settings' AND COLUMN_NAME = 'show_units_sold_badge'
    ),
    'SELECT ''skip company_settings.show_units_sold_badge'' AS info',
    'ALTER TABLE company_settings ADD COLUMN show_units_sold_badge TINYINT(1) NOT NULL DEFAULT 1'
));
PREPARE stmt FROM @s;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- company_settings.show_low_stock_exact
SET @s = (SELECT IF(
    EXISTS(
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'company_settings' AND COLUMN_NAME = 'show_low_stock_exact'
    ),
    'SELECT ''skip company_settings.show_low_stock_exact'' AS info',
    'ALTER TABLE company_settings ADD COLUMN show_low_stock_exact TINYINT(1) NOT NULL DEFAULT 1'
));
PREPARE stmt FROM @s;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- company_settings.push_notifications_enabled
SET @s = (SELECT IF(
    EXISTS(
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'company_settings' AND COLUMN_NAME = 'push_notifications_enabled'
    ),
    'SELECT ''skip company_settings.push_notifications_enabled'' AS info',
    'ALTER TABLE company_settings ADD COLUMN push_notifications_enabled TINYINT(1) NOT NULL DEFAULT 1'
));
PREPARE stmt FROM @s;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- company_settings.sms_api_enabled
SET @s = (SELECT IF(
    EXISTS(
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'company_settings' AND COLUMN_NAME = 'sms_api_enabled'
    ),
    'SELECT ''skip company_settings.sms_api_enabled'' AS info',
    'ALTER TABLE company_settings ADD COLUMN sms_api_enabled TINYINT(1) NOT NULL DEFAULT 0'
));
PREPARE stmt FROM @s;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- company_settings.whatsapp_api_enabled
SET @s = (SELECT IF(
    EXISTS(
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'company_settings' AND COLUMN_NAME = 'whatsapp_api_enabled'
    ),
    'SELECT ''skip company_settings.whatsapp_api_enabled'' AS info',
    'ALTER TABLE company_settings ADD COLUMN whatsapp_api_enabled TINYINT(1) NOT NULL DEFAULT 0'
));
PREPARE stmt FROM @s;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- company_settings.vapid_public_key
SET @s = (SELECT IF(
    EXISTS(
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'company_settings' AND COLUMN_NAME = 'vapid_public_key'
    ),
    'SELECT ''skip company_settings.vapid_public_key'' AS info',
    'ALTER TABLE company_settings ADD COLUMN vapid_public_key VARCHAR(500) DEFAULT NULL'
));
PREPARE stmt FROM @s;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS product_reviews (
    id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    product_id        BIGINT UNSIGNED NOT NULL,
    user_id           BIGINT UNSIGNED NOT NULL,
    order_id          BIGINT UNSIGNED DEFAULT NULL,
    rating            TINYINT UNSIGNED NOT NULL,
    title             VARCHAR(160)    DEFAULT NULL,
    body              TEXT            DEFAULT NULL,
    status            ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
    verified_purchase TINYINT(1)      NOT NULL DEFAULT 0,
    created_at        TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_product_reviews_user_order_product (user_id, order_id, product_id),
    KEY idx_product_reviews_product_status (product_id, status),
    CONSTRAINT fk_product_reviews_product FOREIGN KEY (product_id)
        REFERENCES products (id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_product_reviews_user FOREIGN KEY (user_id)
        REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_product_reviews_order FOREIGN KEY (order_id)
        REFERENCES orders (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS platform_feedback (
    id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id    BIGINT UNSIGNED DEFAULT NULL,
    rating     TINYINT UNSIGNED NOT NULL,
    comment    TEXT            DEFAULT NULL,
    created_at TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_platform_feedback_user (user_id),
    CONSTRAINT fk_platform_feedback_user FOREIGN KEY (user_id)
        REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS push_subscriptions (
    id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id    BIGINT UNSIGNED NOT NULL,
    endpoint   VARCHAR(500)    NOT NULL,
    p256dh     VARCHAR(255)    NOT NULL,
    auth       VARCHAR(255)    NOT NULL,
    user_agent VARCHAR(255)    DEFAULT NULL,
    created_at TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_push_endpoint (endpoint(191)),
    KEY idx_push_user (user_id),
    CONSTRAINT fk_push_subscriptions_user FOREIGN KEY (user_id)
        REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- support_conversations.product_id
SET @s = (SELECT IF(
    EXISTS(
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'support_conversations' AND COLUMN_NAME = 'product_id'
    ),
    'SELECT ''skip support_conversations.product_id'' AS info',
    'ALTER TABLE support_conversations ADD COLUMN product_id BIGINT UNSIGNED DEFAULT NULL AFTER guest_email'
));
PREPARE stmt FROM @s;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- support_conversations.shop_id
SET @s = (SELECT IF(
    EXISTS(
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'support_conversations' AND COLUMN_NAME = 'shop_id'
    ),
    'SELECT ''skip support_conversations.shop_id'' AS info',
    'ALTER TABLE support_conversations ADD COLUMN shop_id BIGINT UNSIGNED DEFAULT NULL AFTER product_id'
));
PREPARE stmt FROM @s;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- support_conversations.order_id
SET @s = (SELECT IF(
    EXISTS(
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'support_conversations' AND COLUMN_NAME = 'order_id'
    ),
    'SELECT ''skip support_conversations.order_id'' AS info',
    'ALTER TABLE support_conversations ADD COLUMN order_id BIGINT UNSIGNED DEFAULT NULL AFTER shop_id'
));
PREPARE stmt FROM @s;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- support_conversations.context_type
SET @s = (SELECT IF(
    EXISTS(
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'support_conversations' AND COLUMN_NAME = 'context_type'
    ),
    'SELECT ''skip support_conversations.context_type'' AS info',
    'ALTER TABLE support_conversations ADD COLUMN context_type ENUM(''general'',''product'',''order'') NOT NULL DEFAULT ''general'' AFTER order_id'
));
PREPARE stmt FROM @s;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- support_conversations.routed_to
SET @s = (SELECT IF(
    EXISTS(
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'support_conversations' AND COLUMN_NAME = 'routed_to'
    ),
    'SELECT ''skip support_conversations.routed_to'' AS info',
    'ALTER TABLE support_conversations ADD COLUMN routed_to ENUM(''pending'',''dpm'',''shop'') NOT NULL DEFAULT ''pending'' AFTER context_type'
));
PREPARE stmt FROM @s;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- support_conversations.bot_step_key
SET @s = (SELECT IF(
    EXISTS(
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'support_conversations' AND COLUMN_NAME = 'bot_step_key'
    ),
    'SELECT ''skip support_conversations.bot_step_key'' AS info',
    'ALTER TABLE support_conversations ADD COLUMN bot_step_key VARCHAR(80) DEFAULT NULL AFTER routed_to'
));
PREPARE stmt FROM @s;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- support_conversations.shop_unread_count
SET @s = (SELECT IF(
    EXISTS(
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'support_conversations' AND COLUMN_NAME = 'shop_unread_count'
    ),
    'SELECT ''skip support_conversations.shop_unread_count'' AS info',
    'ALTER TABLE support_conversations ADD COLUMN shop_unread_count INT UNSIGNED NOT NULL DEFAULT 0 AFTER admin_unread_count'
));
PREPARE stmt FROM @s;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- support_messages.sender_type (extend enum with bot + shop)
SET @s = (SELECT IF(
    EXISTS(
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'support_messages'
          AND COLUMN_NAME = 'sender_type'
          AND COLUMN_TYPE LIKE '%bot%'
    ),
    'SELECT ''skip support_messages.sender_type'' AS info',
    'ALTER TABLE support_messages MODIFY COLUMN sender_type ENUM(''customer'',''admin'',''bot'',''shop'') NOT NULL'
));
PREPARE stmt FROM @s;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

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
