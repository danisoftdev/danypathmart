-- Phase M5: shop referral program & share codes

ALTER TABLE shops
    ADD COLUMN referral_code VARCHAR(20) DEFAULT NULL AFTER slug,
    ADD COLUMN referred_by_shop_id BIGINT UNSIGNED DEFAULT NULL AFTER referral_code,
    ADD UNIQUE KEY uq_shops_referral_code (referral_code),
    ADD KEY idx_shops_referred_by (referred_by_shop_id),
    ADD CONSTRAINT fk_shops_referred_by FOREIGN KEY (referred_by_shop_id)
        REFERENCES shops (id) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE shop_applications
    ADD COLUMN referred_by_shop_code VARCHAR(40) DEFAULT NULL,
    ADD COLUMN referred_by_shop_id BIGINT UNSIGNED DEFAULT NULL;

ALTER TABLE company_settings
    ADD COLUMN shop_referral_bonus_amount DECIMAL(12,2) NOT NULL DEFAULT 50.00,
    ADD COLUMN shop_referral_sales_target INT UNSIGNED NOT NULL DEFAULT 10,
    ADD COLUMN shop_referral_count_on ENUM('paid','collected') NOT NULL DEFAULT 'collected';

CREATE TABLE IF NOT EXISTS shop_referrals (
    id                      BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    referrer_shop_id        BIGINT UNSIGNED NOT NULL,
    referred_shop_id        BIGINT UNSIGNED NOT NULL,
    qualifying_sales_count  INT UNSIGNED    NOT NULL DEFAULT 0,
    bonus_paid_at           TIMESTAMP       NULL DEFAULT NULL,
    created_at              TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_shop_referrals_referred (referred_shop_id),
    KEY idx_shop_referrals_referrer (referrer_shop_id),
    CONSTRAINT fk_shop_referrals_referrer FOREIGN KEY (referrer_shop_id)
        REFERENCES shops (id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_shop_referrals_referred FOREIGN KEY (referred_shop_id)
        REFERENCES shops (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS shop_referral_orders (
    referral_id BIGINT UNSIGNED NOT NULL,
    order_id    BIGINT UNSIGNED NOT NULL,
    created_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (order_id),
    KEY idx_shop_referral_orders_referral (referral_id),
    CONSTRAINT fk_shop_referral_orders_referral FOREIGN KEY (referral_id)
        REFERENCES shop_referrals (id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_shop_referral_orders_order FOREIGN KEY (order_id)
        REFERENCES orders (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
