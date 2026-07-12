-- Free first month for new shops (replaces grace-days UX).
-- Soft account deletion (14-day restore window).
-- Idempotent — safe to re-run.

-- company_settings.shop_new_shop_free_month_enabled
SET @s = (SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'company_settings' AND COLUMN_NAME = 'shop_new_shop_free_month_enabled'),
    'SELECT ''skip shop_new_shop_free_month_enabled'' AS info',
    'ALTER TABLE company_settings ADD COLUMN shop_new_shop_free_month_enabled TINYINT(1) NOT NULL DEFAULT 0 AFTER shop_renewal_grace_days'
));
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Zero out grace (no longer used for visibility / standing).
UPDATE company_settings SET shop_renewal_grace_days = 0 WHERE shop_renewal_grace_days <> 0;

-- users: pending_deletion status + deletion audit fields
SET @s = (SELECT IF(
    EXISTS(
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'status'
          AND COLUMN_TYPE LIKE '%pending_deletion%'
    ),
    'SELECT ''skip users.status pending_deletion'' AS info',
    'ALTER TABLE users MODIFY COLUMN status ENUM(''unverified'',''verified'',''disabled'',''pending_deletion'') NOT NULL DEFAULT ''unverified'''
));
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @s = (SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'deletion_requested_at'),
    'SELECT ''skip users.deletion_requested_at'' AS info',
    'ALTER TABLE users ADD COLUMN deletion_requested_at DATETIME DEFAULT NULL AFTER status'
));
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @s = (SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'deletion_reason'),
    'SELECT ''skip users.deletion_reason'' AS info',
    'ALTER TABLE users ADD COLUMN deletion_reason VARCHAR(80) DEFAULT NULL AFTER deletion_requested_at'
));
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @s = (SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'deletion_reason_detail'),
    'SELECT ''skip users.deletion_reason_detail'' AS info',
    'ALTER TABLE users ADD COLUMN deletion_reason_detail VARCHAR(500) DEFAULT NULL AFTER deletion_reason'
));
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;
