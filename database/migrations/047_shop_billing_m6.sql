ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS shop_billing_enabled TINYINT(1) NOT NULL DEFAULT 0;

ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS shop_registration_fee_ghs DECIMAL(10,2) NOT NULL DEFAULT 0;

ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS shop_renewal_fee_ghs DECIMAL(10,2) NOT NULL DEFAULT 0;

ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS shop_renewal_period ENUM('monthly','yearly') NOT NULL DEFAULT 'yearly';

ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS shop_renewal_grace_days INT UNSIGNED NOT NULL DEFAULT 7;

ALTER TABLE shop_applications ADD COLUMN IF NOT EXISTS registration_fee_paid TINYINT(1) NOT NULL DEFAULT 0;

ALTER TABLE shop_applications ADD COLUMN IF NOT EXISTS registration_payment_ref VARCHAR(80) DEFAULT NULL;

ALTER TABLE shop_applications ADD COLUMN IF NOT EXISTS registration_fee_waived TINYINT(1) NOT NULL DEFAULT 0;

ALTER TABLE shop_applications MODIFY status ENUM('pending_payment','new','approved','rejected') NOT NULL DEFAULT 'new';

CREATE TABLE IF NOT EXISTS shop_subscriptions (
    shop_id         BIGINT UNSIGNED NOT NULL,
    status          ENUM('active','past_due','waived','cancelled') NOT NULL DEFAULT 'active',
    period_start    DATE            NOT NULL,
    period_end      DATE            NOT NULL,
    waived_until    DATE            DEFAULT NULL,
    waiver_note     VARCHAR(500)    DEFAULT NULL,
    waived_by       BIGINT UNSIGNED DEFAULT NULL,
    created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (shop_id),
    KEY idx_shop_subscriptions_status (status, period_end),
    CONSTRAINT fk_shop_subscriptions_shop FOREIGN KEY (shop_id)
        REFERENCES shops (id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_shop_subscriptions_waived_by FOREIGN KEY (waived_by)
        REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS shop_billing_payments (
    id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    shop_id         BIGINT UNSIGNED DEFAULT NULL,
    application_id  BIGINT UNSIGNED DEFAULT NULL,
    payment_type    ENUM('registration','renewal') NOT NULL,
    amount_ghs      DECIMAL(10,2)   NOT NULL,
    paystack_ref    VARCHAR(80)     NOT NULL,
    status          ENUM('pending','paid','failed') NOT NULL DEFAULT 'pending',
    paid_at         TIMESTAMP       NULL DEFAULT NULL,
    created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_shop_billing_paystack_ref (paystack_ref),
    KEY idx_shop_billing_payments_shop (shop_id),
    KEY idx_shop_billing_payments_app (application_id),
    CONSTRAINT fk_shop_billing_payments_shop FOREIGN KEY (shop_id)
        REFERENCES shops (id) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_shop_billing_payments_app FOREIGN KEY (application_id)
        REFERENCES shop_applications (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
