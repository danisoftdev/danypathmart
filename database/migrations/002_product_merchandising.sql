-- Product merchandising fields for admin-managed card badges, ratings, and homepage sections.
ALTER TABLE products
    ADD COLUMN compare_at_price DECIMAL(12,2) DEFAULT NULL AFTER cost_price,
    ADD COLUMN rating_avg DECIMAL(2,1) DEFAULT NULL AFTER compare_at_price,
    ADD COLUMN rating_count INT NOT NULL DEFAULT 0 AFTER rating_avg,
    ADD COLUMN badge_label VARCHAR(40) DEFAULT NULL AFTER rating_count,
    ADD COLUMN is_featured TINYINT(1) NOT NULL DEFAULT 0 AFTER badge_label,
    ADD COLUMN is_flash_deal TINYINT(1) NOT NULL DEFAULT 0 AFTER is_featured;
