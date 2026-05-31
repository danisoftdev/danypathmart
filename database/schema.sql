-- =============================================================================
-- DanyPathMart — MySQL 8 Schema (18 Tables)
-- SDA Youth Insignias & Materials E-Commerce Platform
-- Developed & Owned by danysoftdev · danypathmart.com
-- -----------------------------------------------------------------------------
-- Engine:  InnoDB | Charset: utf8mb4 / utf8mb4_unicode_ci
-- Import:  phpMyAdmin -> select danypathmart_db -> Import -> this file
-- =============================================================================

SET NAMES utf8mb4;
SET time_zone = '+00:00';
SET FOREIGN_KEY_CHECKS = 0;

-- Drop in reverse dependency order so the script is re-runnable ---------------
DROP TABLE IF EXISTS image_search_alerts;
DROP TABLE IF EXISTS search_logs;
DROP TABLE IF EXISTS currency_rates;
DROP TABLE IF EXISTS user_sessions;
DROP TABLE IF EXISTS staff_permissions;
DROP TABLE IF EXISTS totp_temp_tokens;
DROP TABLE IF EXISTS user_credentials;
DROP TABLE IF EXISTS email_verifications;
DROP TABLE IF EXISTS company_settings;
DROP TABLE IF EXISTS shipping_settings;
DROP TABLE IF EXISTS payments;
DROP TABLE IF EXISTS order_tracking;
DROP TABLE IF EXISTS order_items;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS addresses;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS users;

SET FOREIGN_KEY_CHECKS = 1;

-- =============================================================================
-- 1. users
-- =============================================================================
CREATE TABLE users (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    name                VARCHAR(120)    NOT NULL,
    username            VARCHAR(60)     NOT NULL,
    email               VARCHAR(190)    NOT NULL,
    password_hash       VARCHAR(255)    NOT NULL,
    phone               VARCHAR(30)     DEFAULT NULL,
    role                ENUM('super_admin','staff','customer') NOT NULL DEFAULT 'customer',
    status              ENUM('unverified','verified','disabled') NOT NULL DEFAULT 'unverified',
    preferred_currency  VARCHAR(3)      NOT NULL DEFAULT 'GHS',
    profile_photo       VARCHAR(255)    DEFAULT NULL,
    totp_secret         VARCHAR(255)    DEFAULT NULL,
    totp_secret_pending VARCHAR(255)    DEFAULT NULL,
    totp_enabled        TINYINT(1)      NOT NULL DEFAULT 0,
    totp_backup_codes   JSON            DEFAULT NULL,
    created_at          TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_users_email (email),
    UNIQUE KEY uq_users_username (username),
    KEY idx_users_role (role),
    KEY idx_users_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 2. categories  (self-referencing parent_id)
-- =============================================================================
CREATE TABLE categories (
    id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    name        VARCHAR(120)    NOT NULL,
    slug        VARCHAR(140)    NOT NULL,
    description TEXT            DEFAULT NULL,
    image_url   VARCHAR(255)    DEFAULT NULL,
    parent_id   BIGINT UNSIGNED DEFAULT NULL,
    created_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_categories_slug (slug),
    KEY idx_categories_parent (parent_id),
    CONSTRAINT fk_categories_parent FOREIGN KEY (parent_id)
        REFERENCES categories (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 3. addresses
-- =============================================================================
CREATE TABLE addresses (
    id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id        BIGINT UNSIGNED NOT NULL,
    recipient_name VARCHAR(120)    NOT NULL,
    phone          VARCHAR(30)     NOT NULL,
    region         VARCHAR(80)     NOT NULL,
    city           VARCHAR(120)    NOT NULL,
    street         VARCHAR(255)    NOT NULL,
    landmark       VARCHAR(255)    DEFAULT NULL,
    is_default     TINYINT(1)      NOT NULL DEFAULT 0,
    created_at     TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_addresses_user (user_id),
    CONSTRAINT fk_addresses_user FOREIGN KEY (user_id)
        REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 4. products  (tags JSON for image-search label matching)
-- =============================================================================
CREATE TABLE products (
    id                    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    category_id           BIGINT UNSIGNED DEFAULT NULL,
    name                  VARCHAR(190)    NOT NULL,
    slug                  VARCHAR(210)    NOT NULL,
    description           TEXT            DEFAULT NULL,
    price                 DECIMAL(12,2)   NOT NULL DEFAULT 0.00,
    stock_qty             INT             NOT NULL DEFAULT 0,
    images                JSON            DEFAULT NULL,
    tags                  JSON            DEFAULT NULL,
    is_preorder           TINYINT(1)      NOT NULL DEFAULT 0,
    origin_country        VARCHAR(80)     DEFAULT NULL,
    cbm_length            DECIMAL(10,2)   DEFAULT NULL,
    cbm_width             DECIMAL(10,2)   DEFAULT NULL,
    cbm_height            DECIMAL(10,2)   DEFAULT NULL,
    cbm_weight            DECIMAL(10,2)   DEFAULT NULL,
    intl_freight_rate     DECIMAL(10,2)   DEFAULT NULL,
    estimated_arrival_days INT            DEFAULT NULL,
    status                ENUM('active','inactive','draft') NOT NULL DEFAULT 'active',
    created_at            TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at            TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_products_slug (slug),
    KEY idx_products_category (category_id),
    KEY idx_products_status (status),
    KEY idx_products_preorder (is_preorder),
    CONSTRAINT fk_products_category FOREIGN KEY (category_id)
        REFERENCES categories (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 5. orders
-- =============================================================================
CREATE TABLE orders (
    id                     BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id                BIGINT UNSIGNED NOT NULL,
    address_id             BIGINT UNSIGNED DEFAULT NULL,
    status                 ENUM('placed','payment_confirmed','processing','shipped','out_for_delivery','delivered','cancelled')
                               NOT NULL DEFAULT 'placed',
    subtotal               DECIMAL(12,2)   NOT NULL DEFAULT 0.00,
    intl_shipping_cost     DECIMAL(12,2)   NOT NULL DEFAULT 0.00,
    local_delivery_cost    DECIMAL(12,2)   NOT NULL DEFAULT 0.00,
    local_delivery_percent DECIMAL(5,2)    NOT NULL DEFAULT 0.00,
    total                  DECIMAL(12,2)   NOT NULL DEFAULT 0.00,
    payment_status         ENUM('pending','paid','failed','refunded') NOT NULL DEFAULT 'pending',
    payment_ref            VARCHAR(120)    DEFAULT NULL,
    notes                  TEXT            DEFAULT NULL,
    created_at             TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at             TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_orders_user (user_id),
    KEY idx_orders_address (address_id),
    KEY idx_orders_status (status),
    KEY idx_orders_payment_status (payment_status),
    KEY idx_orders_payment_ref (payment_ref),
    CONSTRAINT fk_orders_user FOREIGN KEY (user_id)
        REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_orders_address FOREIGN KEY (address_id)
        REFERENCES addresses (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 6. order_items
-- =============================================================================
CREATE TABLE order_items (
    id                 BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    order_id           BIGINT UNSIGNED NOT NULL,
    product_id         BIGINT UNSIGNED DEFAULT NULL,
    quantity           INT             NOT NULL DEFAULT 1,
    unit_price         DECIMAL(12,2)   NOT NULL DEFAULT 0.00,
    is_preorder        TINYINT(1)      NOT NULL DEFAULT 0,
    estimated_arrival  DATE            DEFAULT NULL,
    created_at         TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_order_items_order (order_id),
    KEY idx_order_items_product (product_id),
    CONSTRAINT fk_order_items_order FOREIGN KEY (order_id)
        REFERENCES orders (id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_order_items_product FOREIGN KEY (product_id)
        REFERENCES products (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 7. order_tracking
-- =============================================================================
CREATE TABLE order_tracking (
    id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    order_id   BIGINT UNSIGNED NOT NULL,
    status     ENUM('placed','payment_confirmed','processing','shipped','out_for_delivery','delivered','cancelled')
                   NOT NULL,
    note       TEXT            DEFAULT NULL,
    updated_by BIGINT UNSIGNED DEFAULT NULL,
    created_at TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_order_tracking_order (order_id),
    KEY idx_order_tracking_status (status),
    CONSTRAINT fk_order_tracking_order FOREIGN KEY (order_id)
        REFERENCES orders (id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_order_tracking_user FOREIGN KEY (updated_by)
        REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 8. payments
-- =============================================================================
CREATE TABLE payments (
    id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    order_id     BIGINT UNSIGNED NOT NULL,
    paystack_ref VARCHAR(120)    NOT NULL,
    amount       DECIMAL(12,2)   NOT NULL DEFAULT 0.00,
    channel      VARCHAR(40)     DEFAULT NULL,
    status       ENUM('pending','success','failed','abandoned') NOT NULL DEFAULT 'pending',
    payload      JSON            DEFAULT NULL,
    created_at   TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_payments_ref (paystack_ref),
    KEY idx_payments_order (order_id),
    KEY idx_payments_status (status),
    CONSTRAINT fk_payments_order FOREIGN KEY (order_id)
        REFERENCES orders (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 9. shipping_settings
-- =============================================================================
CREATE TABLE shipping_settings (
    id                          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    local_delivery_base_percent DECIMAL(5,2)    NOT NULL DEFAULT 0.00,
    updated_by                  BIGINT UNSIGNED DEFAULT NULL,
    updated_at                  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_shipping_updated_by (updated_by),
    CONSTRAINT fk_shipping_user FOREIGN KEY (updated_by)
        REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 10. company_settings
-- =============================================================================
CREATE TABLE company_settings (
    id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    company_name     VARCHAR(160)    NOT NULL DEFAULT 'DanyPathMart',
    email            VARCHAR(190)    DEFAULT NULL,
    phone            VARCHAR(30)     DEFAULT NULL,
    whatsapp_group   VARCHAR(255)    DEFAULT NULL,
    whatsapp_support VARCHAR(30)     DEFAULT NULL,
    facebook         VARCHAR(255)    DEFAULT NULL,
    instagram        VARCHAR(255)    DEFAULT NULL,
    twitter          VARCHAR(255)    DEFAULT NULL,
    address          VARCHAR(255)    DEFAULT NULL,
    business_hours   VARCHAR(255)    DEFAULT NULL,
    return_policy    TEXT            DEFAULT NULL,
    usd_to_ghs_rate  DECIMAL(10,4)   NOT NULL DEFAULT 0.0000,
    updated_by       BIGINT UNSIGNED DEFAULT NULL,
    updated_at       TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_company_updated_by (updated_by),
    CONSTRAINT fk_company_user FOREIGN KEY (updated_by)
        REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 11. email_verifications  (registration + password reset OTP / tokens)
-- =============================================================================
CREATE TABLE email_verifications (
    id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id    BIGINT UNSIGNED NOT NULL,
    otp_hash   CHAR(64)        NOT NULL,
    type       ENUM('registration','password_reset') NOT NULL DEFAULT 'registration',
    expires_at DATETIME        NOT NULL,
    attempts   TINYINT UNSIGNED NOT NULL DEFAULT 0,
    created_at TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_email_verifications_user (user_id),
    KEY idx_email_verifications_type (type),
    KEY idx_email_verifications_expires (expires_at),
    CONSTRAINT fk_email_verifications_user FOREIGN KEY (user_id)
        REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 12. user_credentials  (WebAuthn public keys)
-- =============================================================================
CREATE TABLE user_credentials (
    id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id       BIGINT UNSIGNED NOT NULL,
    credential_id VARCHAR(512)    NOT NULL,
    public_key    TEXT            NOT NULL,
    sign_count    BIGINT UNSIGNED NOT NULL DEFAULT 0,
    device_name   VARCHAR(120)    DEFAULT NULL,
    created_at    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_user_credentials_cred (credential_id(191)),
    KEY idx_user_credentials_user (user_id),
    CONSTRAINT fk_user_credentials_user FOREIGN KEY (user_id)
        REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 13. totp_temp_tokens  (5-minute hashed token between password & TOTP step)
-- =============================================================================
CREATE TABLE totp_temp_tokens (
    id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id    BIGINT UNSIGNED NOT NULL,
    token_hash CHAR(64)        NOT NULL,
    expires_at DATETIME        NOT NULL,
    created_at TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_totp_temp_token (token_hash),
    KEY idx_totp_temp_user (user_id),
    KEY idx_totp_temp_expires (expires_at),
    CONSTRAINT fk_totp_temp_user FOREIGN KEY (user_id)
        REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 14. staff_permissions  (15 RBAC toggles stored as JSON)
-- =============================================================================
CREATE TABLE staff_permissions (
    id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id     BIGINT UNSIGNED NOT NULL,
    role_name   VARCHAR(80)     NOT NULL,
    permissions JSON            NOT NULL,
    created_by  BIGINT UNSIGNED DEFAULT NULL,
    updated_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_staff_permissions_user (user_id),
    KEY idx_staff_permissions_creator (created_by),
    CONSTRAINT fk_staff_permissions_user FOREIGN KEY (user_id)
        REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_staff_permissions_creator FOREIGN KEY (created_by)
        REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 15. user_sessions  (refresh token store, per device)
-- =============================================================================
CREATE TABLE user_sessions (
    id                 BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id            BIGINT UNSIGNED NOT NULL,
    refresh_token_hash CHAR(64)        NOT NULL,
    device_info        VARCHAR(255)    DEFAULT NULL,
    ip_address         VARCHAR(45)     DEFAULT NULL,
    last_used          TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at         DATETIME        NOT NULL,
    created_at         TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_user_sessions_token (refresh_token_hash),
    KEY idx_user_sessions_user (user_id),
    KEY idx_user_sessions_expires (expires_at),
    CONSTRAINT fk_user_sessions_user FOREIGN KEY (user_id)
        REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 16. currency_rates
-- =============================================================================
CREATE TABLE currency_rates (
    id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    currency_code VARCHAR(3)      NOT NULL,
    currency_name VARCHAR(80)     NOT NULL,
    rate_to_ghs   DECIMAL(12,4)   NOT NULL DEFAULT 1.0000,
    updated_at    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_currency_code (currency_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 17. search_logs
-- =============================================================================
CREATE TABLE search_logs (
    id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id       BIGINT UNSIGNED DEFAULT NULL,
    query         VARCHAR(255)    NOT NULL,
    results_count INT             NOT NULL DEFAULT 0,
    search_type   ENUM('text','image') NOT NULL DEFAULT 'text',
    created_at    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_search_logs_user (user_id),
    KEY idx_search_logs_query (query),
    KEY idx_search_logs_type (search_type),
    CONSTRAINT fk_search_logs_user FOREIGN KEY (user_id)
        REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 18. image_search_alerts
-- =============================================================================
CREATE TABLE image_search_alerts (
    id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id      BIGINT UNSIGNED DEFAULT NULL,
    image_path   VARCHAR(255)    NOT NULL,
    search_query VARCHAR(255)    DEFAULT NULL,
    labels       JSON            DEFAULT NULL,
    status       ENUM('pending','reviewed','actioned') NOT NULL DEFAULT 'pending',
    admin_note   TEXT            DEFAULT NULL,
    reviewed_by  BIGINT UNSIGNED DEFAULT NULL,
    created_at   TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_image_alerts_user (user_id),
    KEY idx_image_alerts_status (status),
    KEY idx_image_alerts_reviewer (reviewed_by),
    CONSTRAINT fk_image_alerts_user FOREIGN KEY (user_id)
        REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_image_alerts_reviewer FOREIGN KEY (reviewed_by)
        REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- End of schema — 18 tables
-- =============================================================================
