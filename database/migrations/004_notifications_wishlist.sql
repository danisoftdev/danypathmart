-- Customer in-app notifications + admin broadcast log
CREATE TABLE IF NOT EXISTS admin_broadcasts (
    id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    title            VARCHAR(160)    NOT NULL,
    body             TEXT            NOT NULL,
    link_url         VARCHAR(255)    DEFAULT NULL,
    category         ENUM('new_arrival','restock','out_of_stock','system','custom') NOT NULL DEFAULT 'custom',
    send_email       TINYINT(1)      NOT NULL DEFAULT 1,
    recipient_count  INT             NOT NULL DEFAULT 0,
    sent_by          BIGINT UNSIGNED DEFAULT NULL,
    created_at       TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_broadcasts_sent_by (sent_by),
    CONSTRAINT fk_broadcasts_user FOREIGN KEY (sent_by)
        REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_notifications (
    id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id      BIGINT UNSIGNED NOT NULL,
    broadcast_id BIGINT UNSIGNED DEFAULT NULL,
    title        VARCHAR(160)    NOT NULL,
    body         TEXT            NOT NULL,
    link_url     VARCHAR(255)    DEFAULT NULL,
    category     VARCHAR(40)     NOT NULL DEFAULT 'custom',
    is_read      TINYINT(1)      NOT NULL DEFAULT 0,
    created_at   TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_user_notifications_user (user_id),
    KEY idx_user_notifications_read (user_id, is_read),
    CONSTRAINT fk_user_notifications_user FOREIGN KEY (user_id)
        REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_user_notifications_broadcast FOREIGN KEY (broadcast_id)
        REFERENCES admin_broadcasts (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS wishlists (
    user_id    BIGINT UNSIGNED NOT NULL,
    product_id BIGINT UNSIGNED NOT NULL,
    created_at TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, product_id),
    KEY idx_wishlists_product (product_id),
    CONSTRAINT fk_wishlists_user FOREIGN KEY (user_id)
        REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_wishlists_product FOREIGN KEY (product_id)
        REFERENCES products (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
