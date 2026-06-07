-- Phase M6: optional shop-managed promo badges on marketplace products

ALTER TABLE products
    ADD COLUMN shop_badge_label VARCHAR(40) DEFAULT NULL,
    ADD COLUMN shop_promo_free_delivery TINYINT(1) NOT NULL DEFAULT 0,
    ADD COLUMN shop_badge_hidden TINYINT(1) NOT NULL DEFAULT 0;
