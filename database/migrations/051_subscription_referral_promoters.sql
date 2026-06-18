-- Subscription referral (first registration payment) + promoter accounts

ALTER TABLE users
    MODIFY COLUMN role ENUM('super_admin','staff','customer','driver','station_staff','promoter') NOT NULL DEFAULT 'customer';

ALTER TABLE company_settings
    ADD COLUMN subscription_referral_percent DECIMAL(5,2) NOT NULL DEFAULT 15.00,
    ADD COLUMN subscription_referral_sources ENUM('both','promoter','shop') NOT NULL DEFAULT 'both';

ALTER TABLE shop_applications
    ADD COLUMN referred_by_type ENUM('shop','promoter') DEFAULT NULL,
    ADD COLUMN referred_by_promoter_id BIGINT UNSIGNED DEFAULT NULL,
    ADD COLUMN referral_commission_paid TINYINT(1) NOT NULL DEFAULT 0,
    ADD COLUMN reviewed_by BIGINT UNSIGNED DEFAULT NULL;

CREATE TABLE IF NOT EXISTS promoters (
    id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id         BIGINT UNSIGNED NOT NULL,
    display_name    VARCHAR(120)    NOT NULL,
    code            VARCHAR(24)     NOT NULL,
    status          ENUM('pending','active','suspended') NOT NULL DEFAULT 'pending',
    approved_by     BIGINT UNSIGNED DEFAULT NULL,
    approved_at     TIMESTAMP       NULL DEFAULT NULL,
    created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_promoters_user (user_id),
    UNIQUE KEY uq_promoters_code (code),
    KEY idx_promoters_status (status),
    CONSTRAINT fk_promoters_user FOREIGN KEY (user_id)
        REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_promoters_approved_by FOREIGN KEY (approved_by)
        REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS promoter_wallets (
    promoter_id         BIGINT UNSIGNED NOT NULL,
    balance_pending     DECIMAL(12,2)   NOT NULL DEFAULT 0.00,
    balance_available   DECIMAL(12,2)   NOT NULL DEFAULT 0.00,
    balance_reserved    DECIMAL(12,2)   NOT NULL DEFAULT 0.00,
    updated_at          TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (promoter_id),
    CONSTRAINT fk_promoter_wallets_promoter FOREIGN KEY (promoter_id)
        REFERENCES promoters (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS promoter_wallet_transactions (
    id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    promoter_id     BIGINT UNSIGNED NOT NULL,
    amount          DECIMAL(12,2)   NOT NULL,
    balance_bucket  ENUM('pending','available','reserved') NOT NULL,
    balance_after   DECIMAL(12,2)   NOT NULL,
    type            VARCHAR(40)     NOT NULL,
    earning_id      BIGINT UNSIGNED DEFAULT NULL,
    withdrawal_id   BIGINT UNSIGNED DEFAULT NULL,
    note            VARCHAR(255)    DEFAULT NULL,
    created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_promoter_wallet_tx_promoter (promoter_id),
    CONSTRAINT fk_promoter_wallet_tx_promoter FOREIGN KEY (promoter_id)
        REFERENCES promoters (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS promoter_withdrawals (
    id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    promoter_id     BIGINT UNSIGNED NOT NULL,
    amount          DECIMAL(12,2)   NOT NULL,
    status          ENUM('requested','paid','rejected') NOT NULL DEFAULT 'requested',
    payout_method   VARCHAR(40)     NOT NULL DEFAULT 'bank',
    payout_details  JSON            DEFAULT NULL,
    admin_note      VARCHAR(255)    DEFAULT NULL,
    requested_by    BIGINT UNSIGNED NOT NULL,
    processed_by    BIGINT UNSIGNED DEFAULT NULL,
    requested_at    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    processed_at    TIMESTAMP       NULL DEFAULT NULL,
    PRIMARY KEY (id),
    KEY idx_promoter_withdrawals_status (status),
    CONSTRAINT fk_promoter_withdrawals_promoter FOREIGN KEY (promoter_id)
        REFERENCES promoters (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS subscription_referral_earnings (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    application_id      BIGINT UNSIGNED NOT NULL,
    referrer_type       ENUM('shop','promoter') NOT NULL,
    referrer_shop_id    BIGINT UNSIGNED DEFAULT NULL,
    referrer_promoter_id BIGINT UNSIGNED DEFAULT NULL,
    subscription_amount DECIMAL(12,2)   NOT NULL,
    commission_percent  DECIMAL(5,2)    NOT NULL,
    commission_amount   DECIMAL(12,2)   NOT NULL,
    paystack_ref        VARCHAR(80)     DEFAULT NULL,
    status              ENUM('pending','available','reversed') NOT NULL DEFAULT 'pending',
    created_at          TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    released_at         TIMESTAMP       NULL DEFAULT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_sub_ref_application (application_id),
    KEY idx_sub_ref_shop (referrer_shop_id),
    KEY idx_sub_ref_promoter (referrer_promoter_id),
    CONSTRAINT fk_sub_ref_application FOREIGN KEY (application_id)
        REFERENCES shop_applications (id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_sub_ref_shop FOREIGN KEY (referrer_shop_id)
        REFERENCES shops (id) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_sub_ref_promoter FOREIGN KEY (referrer_promoter_id)
        REFERENCES promoters (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
