-- Trust & messaging: reviews, stock on payment, shop search, support bot routing, push/SMS/WhatsApp toggles.

ALTER TABLE products
    ADD COLUMN units_sold INT UNSIGNED NOT NULL DEFAULT 0 AFTER stock_qty;

ALTER TABLE shops
    ADD COLUMN rating_avg DECIMAL(2,1) DEFAULT NULL AFTER logo_url,
    ADD COLUMN rating_count INT UNSIGNED NOT NULL DEFAULT 0 AFTER rating_avg;

ALTER TABLE orders
    ADD COLUMN inventory_committed TINYINT(1) NOT NULL DEFAULT 0 AFTER notify_whatsapp;

ALTER TABLE company_settings
    ADD COLUMN stock_decrement_on_payment TINYINT(1) NOT NULL DEFAULT 1,
    ADD COLUMN show_units_sold_badge TINYINT(1) NOT NULL DEFAULT 1,
    ADD COLUMN show_low_stock_exact TINYINT(1) NOT NULL DEFAULT 1,
    ADD COLUMN push_notifications_enabled TINYINT(1) NOT NULL DEFAULT 1,
    ADD COLUMN sms_api_enabled TINYINT(1) NOT NULL DEFAULT 0,
    ADD COLUMN whatsapp_api_enabled TINYINT(1) NOT NULL DEFAULT 0,
    ADD COLUMN vapid_public_key VARCHAR(500) DEFAULT NULL;

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

ALTER TABLE support_conversations
    ADD COLUMN product_id BIGINT UNSIGNED DEFAULT NULL AFTER guest_email,
    ADD COLUMN shop_id BIGINT UNSIGNED DEFAULT NULL AFTER product_id,
    ADD COLUMN order_id BIGINT UNSIGNED DEFAULT NULL AFTER shop_id,
    ADD COLUMN context_type ENUM('general','product','order') NOT NULL DEFAULT 'general' AFTER order_id,
    ADD COLUMN routed_to ENUM('pending','dpm','shop') NOT NULL DEFAULT 'pending' AFTER context_type,
    ADD COLUMN bot_step_key VARCHAR(80) DEFAULT NULL AFTER routed_to,
    ADD COLUMN shop_unread_count INT UNSIGNED NOT NULL DEFAULT 0 AFTER admin_unread_count;

ALTER TABLE support_messages
    MODIFY COLUMN sender_type ENUM('customer','admin','bot','shop') NOT NULL;

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
