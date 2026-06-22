-- Shop registration promotions: free period, first-registration discount, referral applicant discount.

ALTER TABLE company_settings
    ADD COLUMN shop_registration_free_until DATE DEFAULT NULL,
    ADD COLUMN shop_first_reg_discount_enabled TINYINT(1) NOT NULL DEFAULT 0,
    ADD COLUMN shop_first_reg_discount_type ENUM('percent','fixed') NOT NULL DEFAULT 'fixed',
    ADD COLUMN shop_first_reg_discount_value DECIMAL(10,2) NOT NULL DEFAULT 0,
    ADD COLUMN shop_referral_reg_discount_enabled TINYINT(1) NOT NULL DEFAULT 0,
    ADD COLUMN shop_referral_reg_discount_type ENUM('percent','fixed') NOT NULL DEFAULT 'percent',
    ADD COLUMN shop_referral_reg_discount_value DECIMAL(10,2) NOT NULL DEFAULT 10;

ALTER TABLE shop_applications
    ADD COLUMN registration_list_fee DECIMAL(10,2) DEFAULT NULL,
    ADD COLUMN registration_discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    ADD COLUMN registration_amount_due DECIMAL(10,2) DEFAULT NULL;
