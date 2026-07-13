-- Shop listing moderation note shown to sellers after admin unpublish.
SET @db := DATABASE();

SET @sql := (
  SELECT IF(
    EXISTS(
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'products' AND COLUMN_NAME = 'listing_admin_note'
    ),
    'SELECT ''skip products.listing_admin_note'' AS info',
    'ALTER TABLE products ADD COLUMN listing_admin_note TEXT NULL DEFAULT NULL AFTER listing_status'
  )
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Existing shop listings waiting for review go live (new policy: publish on add).
UPDATE products
SET listing_status = 'approved', status = 'active'
WHERE shop_id IS NOT NULL
  AND listing_status = 'pending';
