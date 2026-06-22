-- Shop self-delivery: sellers fulfill their own orders; DPM shipping applies to company catalog only.

CREATE TABLE IF NOT EXISTS shop_order_fulfillments (
    id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    order_id        BIGINT UNSIGNED NOT NULL,
    shop_id         BIGINT UNSIGNED NOT NULL,
    status          ENUM('awaiting_payment','paid','preparing','out_for_delivery','delivered','cancelled') NOT NULL DEFAULT 'awaiting_payment',
    subtotal        DECIMAL(12,2)   NOT NULL DEFAULT 0.00,
    created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_shop_order_fulfillment (order_id, shop_id),
    KEY idx_shop_fulfillment_shop (shop_id, status),
    CONSTRAINT fk_shop_fulfillment_order FOREIGN KEY (order_id)
        REFERENCES orders (id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_shop_fulfillment_shop FOREIGN KEY (shop_id)
        REFERENCES shops (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS shop_fulfillment_tracking (
    id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    fulfillment_id  BIGINT UNSIGNED NOT NULL,
    status          VARCHAR(40)     NOT NULL,
    note            TEXT            DEFAULT NULL,
    updated_by      BIGINT UNSIGNED DEFAULT NULL,
    created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_shop_fulfillment_tracking (fulfillment_id, id),
    CONSTRAINT fk_shop_fulfillment_tracking FOREIGN KEY (fulfillment_id)
        REFERENCES shop_order_fulfillments (id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_shop_fulfillment_tracking_user FOREIGN KEY (updated_by)
        REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

UPDATE company_settings SET shop_earnings_release_on = 'paid' WHERE shop_earnings_release_on = 'collected';
