-- Public storefront tagline + default search/social description (admin-managed).

SET @db = DATABASE();

SET @sql = IF(
    EXISTS(
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'company_settings' AND COLUMN_NAME = 'site_tagline'
    ),
    'SELECT ''skip company_settings.site_tagline'' AS info',
    'ALTER TABLE company_settings ADD COLUMN site_tagline VARCHAR(500) DEFAULT NULL AFTER business_hours'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
    EXISTS(
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'company_settings' AND COLUMN_NAME = 'site_seo_description'
    ),
    'SELECT ''skip company_settings.site_seo_description'' AS info',
    'ALTER TABLE company_settings ADD COLUMN site_seo_description VARCHAR(320) DEFAULT NULL AFTER site_tagline'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
