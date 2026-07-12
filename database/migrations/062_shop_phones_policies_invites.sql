-- Marketplace UX: customer service phone, policy acceptance audit, shop invites.
-- Idempotent — safe to re-run.

-- shops.customer_service_phone
SET @s = (SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'shops' AND COLUMN_NAME = 'customer_service_phone'),
    'SELECT ''skip shops.customer_service_phone'' AS info',
    'ALTER TABLE shops ADD COLUMN customer_service_phone VARCHAR(40) DEFAULT NULL AFTER contact_phone'
));
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- shop_applications.customer_service_phone
SET @s = (SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'shop_applications' AND COLUMN_NAME = 'customer_service_phone'),
    'SELECT ''skip shop_applications.customer_service_phone'' AS info',
    'ALTER TABLE shop_applications ADD COLUMN customer_service_phone VARCHAR(40) DEFAULT NULL AFTER phone'
));
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Policy acceptance audit on applications
SET @s = (SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'shop_applications' AND COLUMN_NAME = 'accepted_policies_at'),
    'SELECT ''skip shop_applications.accepted_policies_at'' AS info',
    'ALTER TABLE shop_applications
       ADD COLUMN accepted_policies_at TIMESTAMP NULL DEFAULT NULL,
       ADD COLUMN accepted_policy_slugs VARCHAR(500) DEFAULT NULL,
       ADD COLUMN accepted_terms TINYINT(1) NOT NULL DEFAULT 0,
       ADD COLUMN accepted_privacy TINYINT(1) NOT NULL DEFAULT 0,
       ADD COLUMN accepted_seller_policy TINYINT(1) NOT NULL DEFAULT 0,
       ADD COLUMN policies_accepted_ip VARCHAR(45) DEFAULT NULL,
       ADD COLUMN policies_accepted_user_agent VARCHAR(255) DEFAULT NULL'
));
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Admin-created / invite tracking
SET @s = (SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'shop_applications' AND COLUMN_NAME = 'created_by_admin_id'),
    'SELECT ''skip shop_applications.created_by_admin_id'' AS info',
    'ALTER TABLE shop_applications ADD COLUMN created_by_admin_id BIGINT UNSIGNED DEFAULT NULL AFTER reviewed_by'
));
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @s = (SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'shop_applications' AND COLUMN_NAME = 'source'),
    'SELECT ''skip shop_applications.source'' AS info',
    'ALTER TABLE shop_applications ADD COLUMN source ENUM(''public'',''admin_manual'',''admin_preapproved'',''invite'') NOT NULL DEFAULT ''public'' AFTER status'
));
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS shop_invites (
    id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    token           VARCHAR(64)     NOT NULL,
    email           VARCHAR(190)    NOT NULL,
    business_name   VARCHAR(200)    DEFAULT NULL,
    contact_name    VARCHAR(120)    DEFAULT NULL,
    phone           VARCHAR(40)     DEFAULT NULL,
    city            VARCHAR(120)    DEFAULT NULL,
    note            TEXT            DEFAULT NULL,
    created_by      BIGINT UNSIGNED NOT NULL,
    application_id  BIGINT UNSIGNED DEFAULT NULL,
    shop_id         BIGINT UNSIGNED DEFAULT NULL,
    status          ENUM('pending','accepted','expired','cancelled') NOT NULL DEFAULT 'pending',
    expires_at      DATETIME        NOT NULL,
    accepted_at     TIMESTAMP       NULL DEFAULT NULL,
    created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_shop_invites_token (token),
    KEY idx_shop_invites_email (email),
    KEY idx_shop_invites_status (status),
    CONSTRAINT fk_shop_invites_creator FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT fk_shop_invites_application FOREIGN KEY (application_id) REFERENCES shop_applications (id) ON DELETE SET NULL,
    CONSTRAINT fk_shop_invites_shop FOREIGN KEY (shop_id) REFERENCES shops (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
