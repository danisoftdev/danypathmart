-- Phase C: sizing trust (size guides + exchange policy)
CREATE TABLE IF NOT EXISTS size_guides (
    id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    name        VARCHAR(120)    NOT NULL,
    notes       TEXT            DEFAULT NULL,
    created_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS size_guide_rows (
    id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    size_guide_id  BIGINT UNSIGNED NOT NULL,
    size_label     VARCHAR(40)     NOT NULL,
    chest_min      DECIMAL(6,1)    DEFAULT NULL,
    chest_max      DECIMAL(6,1)    DEFAULT NULL,
    waist_min      DECIMAL(6,1)    DEFAULT NULL,
    waist_max      DECIMAL(6,1)    DEFAULT NULL,
    height_min     DECIMAL(6,1)    DEFAULT NULL,
    height_max     DECIMAL(6,1)    DEFAULT NULL,
    sort_order     INT             NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    KEY idx_size_guide_rows_guide (size_guide_id, sort_order),
    CONSTRAINT fk_size_guide_rows_guide FOREIGN KEY (size_guide_id)
        REFERENCES size_guides (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE categories
    ADD COLUMN IF NOT EXISTS size_guide_id BIGINT UNSIGNED DEFAULT NULL AFTER parent_id;

ALTER TABLE products
    ADD COLUMN IF NOT EXISTS size_guide_id BIGINT UNSIGNED DEFAULT NULL AFTER category_id;

ALTER TABLE company_settings
    ADD COLUMN IF NOT EXISTS exchange_enabled TINYINT(1) NOT NULL DEFAULT 1 AFTER bank_account_number,
    ADD COLUMN IF NOT EXISTS exchange_within_days INT NOT NULL DEFAULT 7 AFTER exchange_enabled,
    ADD COLUMN IF NOT EXISTS exchange_policy_note TEXT DEFAULT NULL AFTER exchange_within_days;
