-- Ensure promoter role + tables exist (idempotent).
-- Fixes admin "Could not create promoter" when migration 051 only partially applied.

ALTER TABLE users
    MODIFY COLUMN role ENUM(
        'super_admin',
        'staff',
        'customer',
        'driver',
        'station_staff',
        'promoter'
    ) NOT NULL DEFAULT 'customer';

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
    KEY idx_promoters_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS promoter_wallets (
    promoter_id         BIGINT UNSIGNED NOT NULL,
    balance_pending     DECIMAL(12,2)   NOT NULL DEFAULT 0.00,
    balance_available   DECIMAL(12,2)   NOT NULL DEFAULT 0.00,
    balance_reserved    DECIMAL(12,2)   NOT NULL DEFAULT 0.00,
    updated_at          TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (promoter_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
