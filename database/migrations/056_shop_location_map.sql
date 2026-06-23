-- Shop & DPM location pins for maps, plus shop pickup at seller location.
-- Idempotent — safe to re-run.

-- shops.street_address
SET @s = (SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'shops' AND COLUMN_NAME = 'street_address'),
    'SELECT ''skip shops.street_address'' AS info',
    'ALTER TABLE shops ADD COLUMN street_address VARCHAR(255) DEFAULT NULL AFTER city'
));
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @s = (SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'shops' AND COLUMN_NAME = 'region'),
    'SELECT ''skip shops.region'' AS info',
    'ALTER TABLE shops ADD COLUMN region VARCHAR(80) DEFAULT NULL AFTER street_address'
));
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @s = (SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'shops' AND COLUMN_NAME = 'latitude'),
    'SELECT ''skip shops.latitude'' AS info',
    'ALTER TABLE shops ADD COLUMN latitude DECIMAL(10,7) DEFAULT NULL AFTER region'
));
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @s = (SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'shops' AND COLUMN_NAME = 'longitude'),
    'SELECT ''skip shops.longitude'' AS info',
    'ALTER TABLE shops ADD COLUMN longitude DECIMAL(10,7) DEFAULT NULL AFTER latitude'
));
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @s = (SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'shops' AND COLUMN_NAME = 'allows_shop_pickup'),
    'SELECT ''skip shops.allows_shop_pickup'' AS info',
    'ALTER TABLE shops ADD COLUMN allows_shop_pickup TINYINT(1) NOT NULL DEFAULT 0 AFTER longitude'
));
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- shop_applications
SET @s = (SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'shop_applications' AND COLUMN_NAME = 'street_address'),
    'SELECT ''skip shop_applications.street_address'' AS info',
    'ALTER TABLE shop_applications ADD COLUMN street_address VARCHAR(255) DEFAULT NULL AFTER city'
));
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @s = (SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'shop_applications' AND COLUMN_NAME = 'region'),
    'SELECT ''skip shop_applications.region'' AS info',
    'ALTER TABLE shop_applications ADD COLUMN region VARCHAR(80) DEFAULT NULL AFTER street_address'
));
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @s = (SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'shop_applications' AND COLUMN_NAME = 'latitude'),
    'SELECT ''skip shop_applications.latitude'' AS info',
    'ALTER TABLE shop_applications ADD COLUMN latitude DECIMAL(10,7) DEFAULT NULL AFTER region'
));
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @s = (SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'shop_applications' AND COLUMN_NAME = 'longitude'),
    'SELECT ''skip shop_applications.longitude'' AS info',
    'ALTER TABLE shop_applications ADD COLUMN longitude DECIMAL(10,7) DEFAULT NULL AFTER latitude'
));
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @s = (SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'shop_applications' AND COLUMN_NAME = 'allows_shop_pickup'),
    'SELECT ''skip shop_applications.allows_shop_pickup'' AS info',
    'ALTER TABLE shop_applications ADD COLUMN allows_shop_pickup TINYINT(1) NOT NULL DEFAULT 0 AFTER longitude'
));
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- shop_order_fulfillments.fulfillment_mode
SET @s = (SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'shop_order_fulfillments' AND COLUMN_NAME = 'fulfillment_mode'),
    'SELECT ''skip shop_order_fulfillments.fulfillment_mode'' AS info',
    'ALTER TABLE shop_order_fulfillments ADD COLUMN fulfillment_mode ENUM(''delivery'',''shop_pickup'') NOT NULL DEFAULT ''delivery'' AFTER subtotal'
));
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- DPM company HQ pin
SET @s = (SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'company_settings' AND COLUMN_NAME = 'latitude'),
    'SELECT ''skip company_settings.latitude'' AS info',
    'ALTER TABLE company_settings ADD COLUMN latitude DECIMAL(10,7) DEFAULT NULL'
));
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @s = (SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'company_settings' AND COLUMN_NAME = 'longitude'),
    'SELECT ''skip company_settings.longitude'' AS info',
    'ALTER TABLE company_settings ADD COLUMN longitude DECIMAL(10,7) DEFAULT NULL'
));
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;
