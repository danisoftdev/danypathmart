-- Phase E: group / institutional buying (quotes + group order lines)
CREATE TABLE IF NOT EXISTS quotes (
    id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id           BIGINT UNSIGNED NOT NULL,
    quote_number      VARCHAR(32) NOT NULL,
    organization_name VARCHAR(200) NOT NULL,
    contact_name      VARCHAR(120) NOT NULL,
    contact_email     VARCHAR(180) NOT NULL,
    contact_phone     VARCHAR(40) DEFAULT NULL,
    status            ENUM('requested','proforma_sent','approved_pay_later','converted','rejected')
                      NOT NULL DEFAULT 'requested',
    subtotal          DECIMAL(12,2) NOT NULL DEFAULT 0,
    intl_shipping_cost DECIMAL(12,2) NOT NULL DEFAULT 0,
    local_delivery_cost DECIMAL(12,2) NOT NULL DEFAULT 0,
    local_delivery_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
    total             DECIMAL(12,2) NOT NULL DEFAULT 0,
    customer_notes    TEXT DEFAULT NULL,
    admin_notes       TEXT DEFAULT NULL,
    proforma_note     TEXT DEFAULT NULL,
    valid_until       DATE DEFAULT NULL,
    proforma_sent_at  DATETIME DEFAULT NULL,
    approved_at       DATETIME DEFAULT NULL,
    converted_order_id BIGINT UNSIGNED DEFAULT NULL,
    reviewed_by       BIGINT UNSIGNED DEFAULT NULL,
    created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_quotes_number (quote_number),
    KEY idx_quotes_user (user_id, created_at),
    KEY idx_quotes_status (status, created_at),
    CONSTRAINT fk_quotes_user FOREIGN KEY (user_id)
        REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS quote_items (
    id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    quote_id       BIGINT UNSIGNED NOT NULL,
    product_id     BIGINT UNSIGNED NOT NULL,
    quantity       INT NOT NULL DEFAULT 1,
    unit_price     DECIMAL(12,2) DEFAULT NULL,
    recipient_name VARCHAR(120) DEFAULT NULL,
    size_label     VARCHAR(40) DEFAULT NULL,
    sort_order     INT NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    KEY idx_quote_items_quote (quote_id, sort_order),
    CONSTRAINT fk_quote_items_quote FOREIGN KEY (quote_id)
        REFERENCES quotes (id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_quote_items_product FOREIGN KEY (product_id)
        REFERENCES products (id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
