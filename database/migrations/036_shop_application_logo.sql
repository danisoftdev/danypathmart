-- Optional shop logo on applications (Phase M4)
ALTER TABLE shop_applications
    ADD COLUMN logo_url VARCHAR(500) DEFAULT NULL AFTER description;
