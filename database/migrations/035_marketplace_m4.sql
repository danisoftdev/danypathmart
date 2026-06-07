CREATE TABLE IF NOT EXISTS shops (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    name                VARCHAR(200)    NOT NULL,
    slug                VARCHAR(120)    NOT NULL,
    logo_url            VARCHAR(500)    DEFAULT NULL,
    banner_url          VARCHAR(500)    DEFAULT NULL,
    description         TEXT            DEFAULT NULL,
    contact_email       VARCHAR(190)    NOT NULL,
    contact_phone       VARCHAR(40)     DEFAULT NULL,
    city                VARCHAR(120)    NOT NULL,
    commission_percent  DECIMAL(5,2)    DEFAULT NULL,
    bank_name           VARCHAR(120)    DEFAULT NULL,
    bank_account_name   VARCHAR(200)    DEFAULT NULL,
    bank_account_number VARCHAR(60)     DEFAULT NULL,
    momo_number         VARCHAR(40)     DEFAULT NULL,
    status              ENUM('pending','active','suspended') NOT NULL DEFAULT 'pending',
    is_published        TINYINT(1)      NOT NULL DEFAULT 1,
    created_at          TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_shops_slug (slug),
    KEY idx_shops_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS shop_applications (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id             BIGINT UNSIGNED DEFAULT NULL,
    business_name       VARCHAR(200)    NOT NULL,
    contact_name        VARCHAR(120)    NOT NULL,
    email               VARCHAR(190)    NOT NULL,
    phone               VARCHAR(40)     NOT NULL,
    city                VARCHAR(120)    NOT NULL,
    description         TEXT            DEFAULT NULL,
    bank_name           VARCHAR(120)    DEFAULT NULL,
    bank_account_name   VARCHAR(200)    DEFAULT NULL,
    bank_account_number VARCHAR(60)     DEFAULT NULL,
    momo_number         VARCHAR(40)     DEFAULT NULL,
    status              ENUM('new','approved','rejected') NOT NULL DEFAULT 'new',
    admin_note          TEXT            DEFAULT NULL,
    shop_id             BIGINT UNSIGNED DEFAULT NULL,
    reviewed_at         TIMESTAMP       NULL DEFAULT NULL,
    created_at          TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_shop_applications_status (status),
    KEY idx_shop_applications_user (user_id),
    CONSTRAINT fk_shop_applications_user FOREIGN KEY (user_id)
        REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_shop_applications_shop FOREIGN KEY (shop_id)
        REFERENCES shops (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS shop_members (
    shop_id     BIGINT UNSIGNED NOT NULL,
    user_id     BIGINT UNSIGNED NOT NULL,
    role        ENUM('owner','staff') NOT NULL DEFAULT 'owner',
    created_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (shop_id, user_id),
    KEY idx_shop_members_user (user_id),
    CONSTRAINT fk_shop_members_shop FOREIGN KEY (shop_id)
        REFERENCES shops (id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_shop_members_user FOREIGN KEY (user_id)
        REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS shop_wallets (
    shop_id             BIGINT UNSIGNED NOT NULL,
    balance_pending     DECIMAL(12,2)   NOT NULL DEFAULT 0.00,
    balance_available   DECIMAL(12,2)   NOT NULL DEFAULT 0.00,
    balance_reserved    DECIMAL(12,2)   NOT NULL DEFAULT 0.00,
    updated_at          TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (shop_id),
    CONSTRAINT fk_shop_wallets_shop FOREIGN KEY (shop_id)
        REFERENCES shops (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS shop_wallet_transactions (
    id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    shop_id         BIGINT UNSIGNED NOT NULL,
    amount          DECIMAL(12,2)   NOT NULL,
    balance_bucket  ENUM('pending','available','reserved') NOT NULL,
    balance_after   DECIMAL(12,2)   NOT NULL,
    type            VARCHAR(40)     NOT NULL,
    order_id        BIGINT UNSIGNED DEFAULT NULL,
    withdrawal_id   BIGINT UNSIGNED DEFAULT NULL,
    note            VARCHAR(500)    DEFAULT NULL,
    created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_shop_wallet_tx_shop (shop_id, created_at),
    KEY idx_shop_wallet_tx_order (order_id),
    CONSTRAINT fk_shop_wallet_tx_shop FOREIGN KEY (shop_id)
        REFERENCES shops (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS shop_order_earnings (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    order_id            BIGINT UNSIGNED NOT NULL,
    shop_id             BIGINT UNSIGNED NOT NULL,
    gross_amount        DECIMAL(12,2)   NOT NULL DEFAULT 0.00,
    commission_rate     DECIMAL(5,2)   NOT NULL DEFAULT 0.00,
    commission_amount   DECIMAL(12,2)   NOT NULL DEFAULT 0.00,
    net_amount          DECIMAL(12,2)   NOT NULL DEFAULT 0.00,
    status              ENUM('pending','available','reserved','paid_out') NOT NULL DEFAULT 'pending',
    created_at          TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    released_at         TIMESTAMP       NULL DEFAULT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_shop_order_earnings (order_id, shop_id),
    KEY idx_shop_order_earnings_shop (shop_id, status),
    CONSTRAINT fk_shop_order_earnings_order FOREIGN KEY (order_id)
        REFERENCES orders (id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_shop_order_earnings_shop FOREIGN KEY (shop_id)
        REFERENCES shops (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS shop_withdrawals (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    shop_id             BIGINT UNSIGNED NOT NULL,
    amount              DECIMAL(12,2)   NOT NULL,
    status              ENUM('requested','approved','paid','rejected') NOT NULL DEFAULT 'requested',
    payout_method       ENUM('bank','momo') NOT NULL DEFAULT 'bank',
    payout_details      JSON            DEFAULT NULL,
    admin_note          TEXT            DEFAULT NULL,
    requested_by        BIGINT UNSIGNED DEFAULT NULL,
    processed_by        BIGINT UNSIGNED DEFAULT NULL,
    requested_at        TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    processed_at        TIMESTAMP       NULL DEFAULT NULL,
    PRIMARY KEY (id),
    KEY idx_shop_withdrawals_shop (shop_id, status),
    CONSTRAINT fk_shop_withdrawals_shop FOREIGN KEY (shop_id)
        REFERENCES shops (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
