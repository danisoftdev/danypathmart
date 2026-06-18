-- =============================================================================
-- DanyPathMart — production repair (MariaDB / Hostinger)
-- Import in phpMyAdmin if migrate-production.php cannot be run.
-- Safe to re-run: uses IF NOT EXISTS where supported.
-- =============================================================================

-- --- employees (login) ---
CREATE TABLE IF NOT EXISTS staff_id_sequences (
    id         TINYINT UNSIGNED NOT NULL DEFAULT 1,
    next_value INT UNSIGNED     NOT NULL DEFAULT 1,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO staff_id_sequences (id, next_value) VALUES (1, 1);

CREATE TABLE IF NOT EXISTS employees (
    id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id         BIGINT UNSIGNED NOT NULL,
    staff_id        VARCHAR(20)     NOT NULL,
    manager_user_id BIGINT UNSIGNED DEFAULT NULL,
    department      VARCHAR(120)    DEFAULT NULL,
    employment_type ENUM('full_time','part_time','contract') DEFAULT NULL,
    start_date      DATE            DEFAULT NULL,
    status          ENUM('active','inactive') NOT NULL DEFAULT 'active',
    created_by      BIGINT UNSIGNED DEFAULT NULL,
    created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_employees_user (user_id),
    UNIQUE KEY uq_employees_staff_id (staff_id),
    CONSTRAINT fk_employees_user FOREIGN KEY (user_id)
        REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --- shops (product listing join) ---
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

-- --- product columns (GET /products) ---
ALTER TABLE products ADD COLUMN IF NOT EXISTS cost_price DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER price;
ALTER TABLE products ADD COLUMN IF NOT EXISTS compare_at_price DECIMAL(12,2) DEFAULT NULL AFTER cost_price;
ALTER TABLE products ADD COLUMN IF NOT EXISTS rating_avg DECIMAL(2,1) DEFAULT NULL AFTER compare_at_price;
ALTER TABLE products ADD COLUMN IF NOT EXISTS rating_count INT NOT NULL DEFAULT 0 AFTER rating_avg;
ALTER TABLE products ADD COLUMN IF NOT EXISTS badge_label VARCHAR(40) DEFAULT NULL AFTER rating_count;
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_featured TINYINT(1) NOT NULL DEFAULT 0 AFTER badge_label;
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_flash_deal TINYINT(1) NOT NULL DEFAULT 0 AFTER is_featured;
ALTER TABLE products ADD COLUMN IF NOT EXISTS shop_id BIGINT UNSIGNED DEFAULT NULL AFTER category_id;
ALTER TABLE products ADD COLUMN IF NOT EXISTS listing_status ENUM('none','pending','approved','rejected') NOT NULL DEFAULT 'none' AFTER status;

-- --- order columns (admin reports) ---
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS unit_cost DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER unit_price;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS unit_cbm_cost DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER unit_cost;

-- --- image search toggle (company settings) ---
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS image_search_enabled TINYINT(1) NOT NULL DEFAULT 0;

-- --- subscription referral + promoters (migration 051) ---
-- Full schema: database/migrations/051_subscription_referral_promoters.sql
-- On server: cd public_html/api && php scripts/migrate-production.php
