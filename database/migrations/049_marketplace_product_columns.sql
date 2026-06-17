-- Marketplace product columns required by GET /products and admin reports.
-- Safe to re-run: migrate-all skips duplicate column/constraint errors.

ALTER TABLE products
    ADD COLUMN shop_id BIGINT UNSIGNED DEFAULT NULL AFTER category_id;

ALTER TABLE products
    ADD COLUMN listing_status ENUM('none','pending','approved','rejected') NOT NULL DEFAULT 'none' AFTER status;

ALTER TABLE products
    ADD CONSTRAINT fk_products_shop FOREIGN KEY (shop_id)
        REFERENCES shops (id) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE company_settings
    ADD COLUMN default_shop_commission_percent DECIMAL(5,2) NOT NULL DEFAULT 10.00;

ALTER TABLE company_settings
    ADD COLUMN shop_earnings_release_on ENUM('paid','collected') NOT NULL DEFAULT 'collected'
        AFTER default_shop_commission_percent;
