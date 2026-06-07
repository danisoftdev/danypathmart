-- Phase B: checkout payment methods (wallet, bank transfer, POD)
ALTER TABLE company_settings
    ADD COLUMN IF NOT EXISTS bank_name VARCHAR(120) DEFAULT NULL AFTER pay_before_delivery,
    ADD COLUMN IF NOT EXISTS bank_account_name VARCHAR(120) DEFAULT NULL AFTER bank_name,
    ADD COLUMN IF NOT EXISTS bank_account_number VARCHAR(40) DEFAULT NULL AFTER bank_account_name;

ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS payment_method ENUM('paystack','wallet','wallet_paystack','bank_transfer','pod') DEFAULT NULL AFTER payment_ref,
    ADD COLUMN IF NOT EXISTS wallet_paid DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER payment_method,
    ADD COLUMN IF NOT EXISTS bank_transfer_ref VARCHAR(120) DEFAULT NULL AFTER wallet_paid,
    ADD COLUMN IF NOT EXISTS bank_transfer_submitted_at TIMESTAMP NULL DEFAULT NULL AFTER bank_transfer_ref;
