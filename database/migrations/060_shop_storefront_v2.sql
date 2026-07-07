-- Shop storefront v2: direct shop payments, trust (reports/cautions), subscription reminders.
-- Idempotent — safe to re-run.

-- shops.verified_at
SET @s = (SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'shops' AND COLUMN_NAME = 'verified_at'),
    'SELECT ''skip shops.verified_at'' AS info',
    'ALTER TABLE shops ADD COLUMN verified_at TIMESTAMP NULL DEFAULT NULL AFTER is_published'
));
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt; 

-- shops payment toggles
SET @s = (SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'shops' AND COLUMN_NAME = 'payment_paystack_enabled'),
    'SELECT ''skip shops.payment_paystack_enabled'' AS info',
    'ALTER TABLE shops ADD COLUMN payment_paystack_enabled TINYINT(1) NOT NULL DEFAULT 0 AFTER momo_number,
     ADD COLUMN payment_momo_enabled TINYINT(1) NOT NULL DEFAULT 1 AFTER payment_paystack_enabled,
     ADD COLUMN payment_physical_enabled TINYINT(1) NOT NULL DEFAULT 1 AFTER payment_momo_enabled,
     ADD COLUMN paystack_subaccount_code VARCHAR(120) DEFAULT NULL AFTER payment_physical_enabled'
));
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- orders storefront columns
SET @s = (SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'storefront_shop_id'),
    'SELECT ''skip orders.storefront_shop_id'' AS info',
    'ALTER TABLE orders ADD COLUMN storefront_shop_id BIGINT UNSIGNED DEFAULT NULL AFTER organization_name,
     ADD COLUMN shop_payment_method ENUM(''paystack'',''momo'',''physical'') DEFAULT NULL AFTER storefront_shop_id,
     ADD COLUMN payment_collector ENUM(''dpm'',''shop'') NOT NULL DEFAULT ''dpm'' AFTER shop_payment_method,
     ADD COLUMN payment_reservation_expires_at TIMESTAMP NULL DEFAULT NULL AFTER payment_collector'
));
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- company_settings trust & reminders
SET @s = (SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'company_settings' AND COLUMN_NAME = 'shop_subscription_reminder_enabled'),
    'SELECT ''skip company_settings.shop_subscription_reminder_enabled'' AS info',
    'ALTER TABLE company_settings ADD COLUMN shop_subscription_reminder_enabled TINYINT(1) NOT NULL DEFAULT 1 AFTER shop_referral_reg_discount_value,
     ADD COLUMN shop_subscription_reminder_days VARCHAR(40) NOT NULL DEFAULT ''7,1'' AFTER shop_subscription_reminder_enabled,
     ADD COLUMN storefront_unpaid_timeout_hours INT UNSIGNED NOT NULL DEFAULT 48 AFTER shop_subscription_reminder_days,
     ADD COLUMN trust_automation_enabled TINYINT(1) NOT NULL DEFAULT 0 AFTER storefront_unpaid_timeout_hours,
     ADD COLUMN trust_auto_cautions_threshold INT UNSIGNED NOT NULL DEFAULT 3 AFTER trust_automation_enabled,
     ADD COLUMN trust_auto_restrict_threshold INT UNSIGNED NOT NULL DEFAULT 3 AFTER trust_auto_cautions_threshold'
));
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

UPDATE company_settings SET default_shop_commission_percent = 0 WHERE default_shop_commission_percent > 0;

CREATE TABLE IF NOT EXISTS shop_reports (
    id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    reporter_user_id BIGINT UNSIGNED NOT NULL,
    shop_id         BIGINT UNSIGNED NOT NULL,
    order_id        BIGINT UNSIGNED NOT NULL,
    reason          VARCHAR(60)     NOT NULL,
    description     TEXT            NOT NULL,
    status          ENUM('open','under_review','resolved','dismissed') NOT NULL DEFAULT 'open',
    admin_note      TEXT            DEFAULT NULL,
    resolved_by     BIGINT UNSIGNED DEFAULT NULL,
    resolved_at     TIMESTAMP       NULL DEFAULT NULL,
    created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_shop_reports_status (status, created_at),
    KEY idx_shop_reports_shop (shop_id),
    KEY idx_shop_reports_order (order_id),
    CONSTRAINT fk_shop_reports_reporter FOREIGN KEY (reporter_user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT fk_shop_reports_shop FOREIGN KEY (shop_id) REFERENCES shops (id) ON DELETE CASCADE,
    CONSTRAINT fk_shop_reports_order FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE,
    CONSTRAINT fk_shop_reports_resolver FOREIGN KEY (resolved_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_cautions (
    id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id         BIGINT UNSIGNED NOT NULL,
    issued_by       BIGINT UNSIGNED DEFAULT NULL,
    level           ENUM('notice','caution','final_warning','restriction','suspension') NOT NULL DEFAULT 'caution',
    message         TEXT            NOT NULL,
    internal_note   TEXT            DEFAULT NULL,
    report_id       BIGINT UNSIGNED DEFAULT NULL,
    expires_at      TIMESTAMP       NULL DEFAULT NULL,
    acknowledged_at TIMESTAMP       NULL DEFAULT NULL,
    created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_user_cautions_user (user_id, created_at),
    KEY idx_user_cautions_pending (user_id, acknowledged_at),
    CONSTRAINT fk_user_cautions_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT fk_user_cautions_issuer FOREIGN KEY (issued_by) REFERENCES users (id) ON DELETE SET NULL,
    CONSTRAINT fk_user_cautions_report FOREIGN KEY (report_id) REFERENCES shop_reports (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS shop_subscription_reminder_log (
    id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    shop_id         BIGINT UNSIGNED NOT NULL,
    reminder_type   VARCHAR(40)     NOT NULL,
    sent_at         TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_shop_reminder (shop_id, reminder_type, sent_at),
    KEY idx_shop_reminder_shop (shop_id),
    CONSTRAINT fk_shop_reminder_shop FOREIGN KEY (shop_id) REFERENCES shops (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Mark existing active shops as verified
UPDATE shops SET verified_at = COALESCE(verified_at, updated_at) WHERE status = 'active' AND verified_at IS NULL;
