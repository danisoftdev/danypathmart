-- Paystack fee policy (admin), richer billing receipts, saved cards + auto-renew.
-- Idempotent — safe to re-run.

-- company_settings: processor fee policy (tax deferred)
SET @s = (SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'company_settings' AND COLUMN_NAME = 'paystack_fee_mode'),
    'SELECT ''skip paystack_fee_mode'' AS info',
    'ALTER TABLE company_settings ADD COLUMN paystack_fee_mode ENUM(''absorb'',''pass_to_payer'') NOT NULL DEFAULT ''absorb'' AFTER shop_new_shop_free_month_enabled'
));
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @s = (SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'company_settings' AND COLUMN_NAME = 'paystack_fee_percent'),
    'SELECT ''skip paystack_fee_percent'' AS info',
    'ALTER TABLE company_settings ADD COLUMN paystack_fee_percent DECIMAL(5,2) NOT NULL DEFAULT 1.95 AFTER paystack_fee_mode'
));
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @s = (SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'company_settings' AND COLUMN_NAME = 'paystack_fee_flat_ghs'),
    'SELECT ''skip paystack_fee_flat_ghs'' AS info',
    'ALTER TABLE company_settings ADD COLUMN paystack_fee_flat_ghs DECIMAL(10,2) NOT NULL DEFAULT 0.00 AFTER paystack_fee_percent'
));
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @s = (SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'company_settings' AND COLUMN_NAME = 'paystack_fee_note'),
    'SELECT ''skip paystack_fee_note'' AS info',
    'ALTER TABLE company_settings ADD COLUMN paystack_fee_note VARCHAR(255) DEFAULT NULL AFTER paystack_fee_flat_ghs'
));
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Expand payment types for free/waiver/card-setup receipts
ALTER TABLE shop_billing_payments
    MODIFY COLUMN payment_type ENUM('registration','renewal','complimentary','card_setup') NOT NULL;

SET @s = (SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'shop_billing_payments' AND COLUMN_NAME = 'receipt_number'),
    'SELECT ''skip receipt_number'' AS info',
    'ALTER TABLE shop_billing_payments ADD COLUMN receipt_number VARCHAR(32) DEFAULT NULL AFTER id'
));
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @s = (SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'shop_billing_payments' AND COLUMN_NAME = 'platform_amount_ghs'),
    'SELECT ''skip platform_amount_ghs'' AS info',
    'ALTER TABLE shop_billing_payments ADD COLUMN platform_amount_ghs DECIMAL(10,2) DEFAULT NULL AFTER amount_ghs'
));
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @s = (SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'shop_billing_payments' AND COLUMN_NAME = 'processor_fee_ghs'),
    'SELECT ''skip processor_fee_ghs'' AS info',
    'ALTER TABLE shop_billing_payments ADD COLUMN processor_fee_ghs DECIMAL(10,2) NOT NULL DEFAULT 0.00 AFTER platform_amount_ghs'
));
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @s = (SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'shop_billing_payments' AND COLUMN_NAME = 'fee_mode'),
    'SELECT ''skip fee_mode'' AS info',
    'ALTER TABLE shop_billing_payments ADD COLUMN fee_mode VARCHAR(20) DEFAULT NULL AFTER processor_fee_ghs'
));
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @s = (SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'shop_billing_payments' AND COLUMN_NAME = 'is_complimentary'),
    'SELECT ''skip is_complimentary'' AS info',
    'ALTER TABLE shop_billing_payments ADD COLUMN is_complimentary TINYINT(1) NOT NULL DEFAULT 0 AFTER fee_mode'
));
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @s = (SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'shop_billing_payments' AND COLUMN_NAME = 'channel'),
    'SELECT ''skip channel'' AS info',
    'ALTER TABLE shop_billing_payments ADD COLUMN channel VARCHAR(40) DEFAULT NULL AFTER is_complimentary'
));
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @s = (SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'shop_billing_payments' AND COLUMN_NAME = 'card_last4'),
    'SELECT ''skip card_last4'' AS info',
    'ALTER TABLE shop_billing_payments ADD COLUMN card_last4 VARCHAR(4) DEFAULT NULL AFTER channel'
));
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @s = (SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'shop_billing_payments' AND COLUMN_NAME = 'notes'),
    'SELECT ''skip notes'' AS info',
    'ALTER TABLE shop_billing_payments ADD COLUMN notes VARCHAR(500) DEFAULT NULL AFTER card_last4'
));
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @s = (SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'shop_billing_payments' AND INDEX_NAME = 'uq_shop_billing_receipt'),
    'SELECT ''skip uq_shop_billing_receipt'' AS info',
    'ALTER TABLE shop_billing_payments ADD UNIQUE KEY uq_shop_billing_receipt (receipt_number)'
));
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Auto-renew on subscriptions
SET @s = (SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'shop_subscriptions' AND COLUMN_NAME = 'auto_renew'),
    'SELECT ''skip auto_renew'' AS info',
    'ALTER TABLE shop_subscriptions ADD COLUMN auto_renew TINYINT(1) NOT NULL DEFAULT 0 AFTER status'
));
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @s = (SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'shop_subscriptions' AND COLUMN_NAME = 'paystack_customer_code'),
    'SELECT ''skip paystack_customer_code'' AS info',
    'ALTER TABLE shop_subscriptions ADD COLUMN paystack_customer_code VARCHAR(80) DEFAULT NULL AFTER auto_renew'
));
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @s = (SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'shop_subscriptions' AND COLUMN_NAME = 'preferred_billing_period'),
    'SELECT ''skip preferred_billing_period'' AS info',
    'ALTER TABLE shop_subscriptions ADD COLUMN preferred_billing_period ENUM(''monthly'',''yearly'') DEFAULT NULL AFTER paystack_customer_code'
));
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS shop_billing_payment_methods (
    id                      BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    shop_id                 BIGINT UNSIGNED NOT NULL,
    authorization_code      VARCHAR(80)     NOT NULL,
    paystack_customer_code  VARCHAR(80)     DEFAULT NULL,
    card_type               VARCHAR(40)     DEFAULT NULL,
    last4                   VARCHAR(4)      DEFAULT NULL,
    exp_month               VARCHAR(2)      DEFAULT NULL,
    exp_year                VARCHAR(4)      DEFAULT NULL,
    bank                    VARCHAR(80)     DEFAULT NULL,
    reusable                TINYINT(1)      NOT NULL DEFAULT 1,
    is_default              TINYINT(1)      NOT NULL DEFAULT 0,
    status                  ENUM('active','removed') NOT NULL DEFAULT 'active',
    created_at              TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_shop_billing_auth (shop_id, authorization_code),
    KEY idx_shop_billing_methods_shop (shop_id, status),
    CONSTRAINT fk_shop_billing_methods_shop FOREIGN KEY (shop_id)
        REFERENCES shops (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
