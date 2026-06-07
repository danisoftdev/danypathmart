-- Flash sale section settings (countdown + copy), stored on company_settings row.
ALTER TABLE company_settings
    ADD COLUMN flash_sale_enabled TINYINT(1) NOT NULL DEFAULT 1 AFTER usd_to_ghs_rate,
    ADD COLUMN flash_sale_title VARCHAR(120) NOT NULL DEFAULT 'Flash deals' AFTER flash_sale_enabled,
    ADD COLUMN flash_sale_subtitle VARCHAR(255) DEFAULT 'Limited picks — ends soon' AFTER flash_sale_title,
    ADD COLUMN flash_sale_ends_at DATETIME DEFAULT NULL AFTER flash_sale_subtitle;
