-- Separate optional monthly / yearly shop renewal fees.
-- Idempotent — safe to re-run.

SET @s = (SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'company_settings' AND COLUMN_NAME = 'shop_renewal_fee_monthly_ghs'),
    'SELECT ''skip shop_renewal_fee_monthly_ghs'' AS info',
    'ALTER TABLE company_settings ADD COLUMN shop_renewal_fee_monthly_ghs DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER shop_renewal_fee_ghs'
));
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @s = (SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'company_settings' AND COLUMN_NAME = 'shop_renewal_fee_yearly_ghs'),
    'SELECT ''skip shop_renewal_fee_yearly_ghs'' AS info',
    'ALTER TABLE company_settings ADD COLUMN shop_renewal_fee_yearly_ghs DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER shop_renewal_fee_monthly_ghs'
));
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Backfill from legacy single fee + period (only where new columns are still 0).
UPDATE company_settings
SET
    shop_renewal_fee_monthly_ghs = CASE
        WHEN shop_renewal_period = 'monthly' AND shop_renewal_fee_monthly_ghs = 0
            THEN shop_renewal_fee_ghs
        ELSE shop_renewal_fee_monthly_ghs
    END,
    shop_renewal_fee_yearly_ghs = CASE
        WHEN shop_renewal_period = 'yearly' AND shop_renewal_fee_yearly_ghs = 0
            THEN shop_renewal_fee_ghs
        WHEN shop_renewal_period <> 'monthly' AND shop_renewal_fee_yearly_ghs = 0 AND shop_renewal_fee_ghs > 0
            THEN shop_renewal_fee_ghs
        ELSE shop_renewal_fee_yearly_ghs
    END;

SET @s = (SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'shop_billing_payments' AND COLUMN_NAME = 'billing_period'),
    'SELECT ''skip shop_billing_payments.billing_period'' AS info',
    'ALTER TABLE shop_billing_payments ADD COLUMN billing_period VARCHAR(20) DEFAULT NULL AFTER payment_type'
));
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;
