-- Shop storefront privacy: open | focused | locked (default focused).
-- Idempotent — safe to re-run.

SET @s = (SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'shops' AND COLUMN_NAME = 'storefront_mode'),
    'SELECT ''skip shops.storefront_mode'' AS info',
    'ALTER TABLE shops ADD COLUMN storefront_mode ENUM(''open'',''focused'',''locked'') NOT NULL DEFAULT ''focused'' AFTER is_published'
));
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;
