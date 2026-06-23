-- DPM point-of-sale: locations, registers, shifts, POS order metadata.
-- Idempotent — safe to re-run.

SET @s = (SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'company_settings' AND COLUMN_NAME = 'pos_module_enabled'),
    'SELECT ''skip company_settings.pos_module_enabled'' AS info',
    'ALTER TABLE company_settings ADD COLUMN pos_module_enabled TINYINT(1) NOT NULL DEFAULT 0'
));
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @s = (SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'company_settings' AND COLUMN_NAME = 'pos_max_cashier_discount_percent'),
    'SELECT ''skip company_settings.pos_max_cashier_discount_percent'' AS info',
    'ALTER TABLE company_settings ADD COLUMN pos_max_cashier_discount_percent DECIMAL(5,2) NOT NULL DEFAULT 10.00'
));
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @s = (SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'company_settings' AND COLUMN_NAME = 'pos_receipt_footer'),
    'SELECT ''skip company_settings.pos_receipt_footer'' AS info',
    'ALTER TABLE company_settings ADD COLUMN pos_receipt_footer VARCHAR(255) DEFAULT NULL'
));
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @s = (SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'company_settings' AND COLUMN_NAME = 'pos_void_window_minutes'),
    'SELECT ''skip company_settings.pos_void_window_minutes'' AS info',
    'ALTER TABLE company_settings ADD COLUMN pos_void_window_minutes INT NOT NULL DEFAULT 30'
));
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @s = (SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'company_settings' AND COLUMN_NAME = 'pos_central_momo'),
    'SELECT ''skip company_settings.pos_central_momo'' AS info',
    'ALTER TABLE company_settings ADD COLUMN pos_central_momo VARCHAR(32) DEFAULT NULL'
));
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS pos_locations (
    id                INT UNSIGNED NOT NULL AUTO_INCREMENT,
    name              VARCHAR(120) NOT NULL,
    address           VARCHAR(255) DEFAULT NULL,
    momo_number       VARCHAR(32) DEFAULT NULL,
    pickup_station_id INT UNSIGNED DEFAULT NULL,
    latitude          DECIMAL(10,7) DEFAULT NULL,
    longitude         DECIMAL(10,7) DEFAULT NULL,
    is_active         TINYINT(1) NOT NULL DEFAULT 1,
    created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_pos_locations_active (is_active, name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pos_registers (
    id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
    location_id  INT UNSIGNED NOT NULL,
    name         VARCHAR(80) NOT NULL,
    code         VARCHAR(32) NOT NULL,
    momo_number  VARCHAR(32) DEFAULT NULL,
    is_active    TINYINT(1) NOT NULL DEFAULT 1,
    created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_pos_registers_code (code),
    KEY idx_pos_registers_location (location_id, is_active),
    CONSTRAINT fk_pos_registers_location FOREIGN KEY (location_id)
        REFERENCES pos_locations (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pos_shifts (
    id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    register_id     INT UNSIGNED NOT NULL,
    location_id     INT UNSIGNED NOT NULL,
    opened_by       BIGINT UNSIGNED NOT NULL,
    closed_by       BIGINT UNSIGNED DEFAULT NULL,
    approved_by     BIGINT UNSIGNED DEFAULT NULL,
    status          ENUM('open','pending_approval','approved','rejected') NOT NULL DEFAULT 'open',
    opening_float   DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    expected_cash   DECIMAL(12,2) DEFAULT NULL,
    counted_cash    DECIMAL(12,2) DEFAULT NULL,
    cash_variance   DECIMAL(12,2) DEFAULT NULL,
    variance_note   VARCHAR(255) DEFAULT NULL,
    rejection_note  VARCHAR(255) DEFAULT NULL,
    opened_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    closed_at       TIMESTAMP NULL DEFAULT NULL,
    approved_at     TIMESTAMP NULL DEFAULT NULL,
    PRIMARY KEY (id),
    KEY idx_pos_shifts_register (register_id, status),
    KEY idx_pos_shifts_opened (opened_at),
    CONSTRAINT fk_pos_shifts_register FOREIGN KEY (register_id)
        REFERENCES pos_registers (id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_pos_shifts_location FOREIGN KEY (location_id)
        REFERENCES pos_locations (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET @s = (SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'sales_channel'),
    'SELECT ''skip orders.sales_channel'' AS info',
    'ALTER TABLE orders ADD COLUMN sales_channel VARCHAR(16) NOT NULL DEFAULT ''online'' AFTER notes'
));
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @s = (SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'pos_shift_id'),
    'SELECT ''skip orders.pos_shift_id'' AS info',
    'ALTER TABLE orders ADD COLUMN pos_shift_id BIGINT UNSIGNED DEFAULT NULL'
));
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @s = (SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'pos_register_id'),
    'SELECT ''skip orders.pos_register_id'' AS info',
    'ALTER TABLE orders ADD COLUMN pos_register_id INT UNSIGNED DEFAULT NULL'
));
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @s = (SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'pos_location_id'),
    'SELECT ''skip orders.pos_location_id'' AS info',
    'ALTER TABLE orders ADD COLUMN pos_location_id INT UNSIGNED DEFAULT NULL'
));
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @s = (SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'pos_cashier_user_id'),
    'SELECT ''skip orders.pos_cashier_user_id'' AS info',
    'ALTER TABLE orders ADD COLUMN pos_cashier_user_id BIGINT UNSIGNED DEFAULT NULL'
));
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @s = (SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'pos_discount_amount'),
    'SELECT ''skip orders.pos_discount_amount'' AS info',
    'ALTER TABLE orders ADD COLUMN pos_discount_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00'
));
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @s = (SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'pos_customer_name'),
    'SELECT ''skip orders.pos_customer_name'' AS info',
    'ALTER TABLE orders ADD COLUMN pos_customer_name VARCHAR(120) DEFAULT NULL'
));
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @s = (SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'pos_customer_phone'),
    'SELECT ''skip orders.pos_customer_phone'' AS info',
    'ALTER TABLE orders ADD COLUMN pos_customer_phone VARCHAR(32) DEFAULT NULL'
));
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @s = (SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'pos_voided_at'),
    'SELECT ''skip orders.pos_voided_at'' AS info',
    'ALTER TABLE orders ADD COLUMN pos_voided_at TIMESTAMP NULL DEFAULT NULL'
));
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS pos_order_payments (
    id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    order_id     BIGINT UNSIGNED NOT NULL,
    method       ENUM('cash','momo','paystack','card') NOT NULL,
    amount       DECIMAL(12,2) NOT NULL,
    reference    VARCHAR(120) DEFAULT NULL,
    momo_number  VARCHAR(32) DEFAULT NULL,
    created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_pos_order_payments_order (order_id),
    CONSTRAINT fk_pos_order_payments_order FOREIGN KEY (order_id)
        REFERENCES orders (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
