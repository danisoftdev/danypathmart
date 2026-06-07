-- Phase D: kit builder (templates + linked products)
CREATE TABLE IF NOT EXISTS kit_templates (
    id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    name         VARCHAR(160) NOT NULL,
    slug         VARCHAR(180) NOT NULL,
    description  TEXT DEFAULT NULL,
    leader_note  TEXT DEFAULT NULL,
    image_url    VARCHAR(500) DEFAULT NULL,
    is_published TINYINT(1) NOT NULL DEFAULT 0,
    sort_order   INT NOT NULL DEFAULT 0,
    created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_kit_templates_slug (slug),
    KEY idx_kit_templates_published (is_published, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS kit_template_items (
    id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    kit_template_id BIGINT UNSIGNED NOT NULL,
    product_id      BIGINT UNSIGNED NOT NULL,
    is_required     TINYINT(1) NOT NULL DEFAULT 1,
    item_label      VARCHAR(160) DEFAULT NULL,
    note            VARCHAR(255) DEFAULT NULL,
    sort_order      INT NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    UNIQUE KEY uq_kit_items_kit_product (kit_template_id, product_id),
    KEY idx_kit_items_kit (kit_template_id, sort_order),
    CONSTRAINT fk_kit_items_kit FOREIGN KEY (kit_template_id)
        REFERENCES kit_templates (id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_kit_items_product FOREIGN KEY (product_id)
        REFERENCES products (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
