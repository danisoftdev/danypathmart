-- Full POS: product barcodes, supervisor PIN, cash change, tender tracking.
-- Idempotent — safe to re-run.

SET @s = (SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND COLUMN_NAME = 'barcode'),
    'SELECT ''skip products.barcode'' AS info',
    'ALTER TABLE products ADD COLUMN barcode VARCHAR(64) DEFAULT NULL AFTER slug'
));
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @s = (SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND INDEX_NAME = 'uq_products_barcode'),
    'SELECT ''skip uq_products_barcode'' AS info',
    'ALTER TABLE products ADD UNIQUE KEY uq_products_barcode (barcode)'
));
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @s = (SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'company_settings' AND COLUMN_NAME = 'pos_supervisor_pin_hash'),
    'SELECT ''skip company_settings.pos_supervisor_pin_hash'' AS info',
    'ALTER TABLE company_settings ADD COLUMN pos_supervisor_pin_hash VARCHAR(255) DEFAULT NULL'
));
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @s = (SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'pos_change_given'),
    'SELECT ''skip orders.pos_change_given'' AS info',
    'ALTER TABLE orders ADD COLUMN pos_change_given DECIMAL(12,2) NOT NULL DEFAULT 0.00'
));
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @s = (SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'pos_cash_tendered'),
    'SELECT ''skip orders.pos_cash_tendered'' AS info',
    'ALTER TABLE orders ADD COLUMN pos_cash_tendered DECIMAL(12,2) DEFAULT NULL'
));
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;
