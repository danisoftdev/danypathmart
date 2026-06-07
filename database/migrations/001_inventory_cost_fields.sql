-- Run once on existing databases to enable inventory & profit reporting.
ALTER TABLE products
    ADD COLUMN cost_price DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER price;

ALTER TABLE order_items
    ADD COLUMN unit_cost DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER unit_price,
    ADD COLUMN unit_cbm_cost DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER unit_cost;
