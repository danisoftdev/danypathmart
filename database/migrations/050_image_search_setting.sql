ALTER TABLE company_settings
    ADD COLUMN IF NOT EXISTS image_search_enabled TINYINT(1) NOT NULL DEFAULT 0;
