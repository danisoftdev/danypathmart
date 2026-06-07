-- Phase A: payment settings + customer wallets
ALTER TABLE company_settings
    ADD COLUMN IF NOT EXISTS paystack_enabled TINYINT(1) NOT NULL DEFAULT 1 AFTER return_policy,
    ADD COLUMN IF NOT EXISTS wallet_checkout_enabled TINYINT(1) NOT NULL DEFAULT 0 AFTER paystack_enabled,
    ADD COLUMN IF NOT EXISTS bank_transfer_enabled TINYINT(1) NOT NULL DEFAULT 0 AFTER wallet_checkout_enabled,
    ADD COLUMN IF NOT EXISTS pod_enabled TINYINT(1) NOT NULL DEFAULT 0 AFTER bank_transfer_enabled,
    ADD COLUMN IF NOT EXISTS pay_before_delivery TINYINT(1) NOT NULL DEFAULT 1 AFTER pod_enabled;

CREATE TABLE IF NOT EXISTS wallets (
    user_id    BIGINT UNSIGNED NOT NULL,
    balance    DECIMAL(12,2)   NOT NULL DEFAULT 0.00,
    updated_at TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id),
    CONSTRAINT fk_wallets_user FOREIGN KEY (user_id)
        REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS wallet_transactions (
    id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id       BIGINT UNSIGNED NOT NULL,
    amount        DECIMAL(12,2)   NOT NULL,
    balance_after DECIMAL(12,2)   NOT NULL,
    type          ENUM('refund','admin_credit','admin_debit','order_payment','adjustment') NOT NULL,
    order_id      BIGINT UNSIGNED DEFAULT NULL,
    note          VARCHAR(500)    DEFAULT NULL,
    created_by    BIGINT UNSIGNED DEFAULT NULL,
    created_at    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_wallet_tx_user (user_id, created_at),
    KEY idx_wallet_tx_order (order_id),
    CONSTRAINT fk_wallet_tx_user FOREIGN KEY (user_id)
        REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_wallet_tx_order FOREIGN KEY (order_id)
        REFERENCES orders (id) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_wallet_tx_admin FOREIGN KEY (created_by)
        REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
