CREATE TABLE IF NOT EXISTS hero_banners (
    id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    kicker      VARCHAR(80)     NOT NULL DEFAULT '',
    title       VARCHAR(160)    NOT NULL,
    subtitle    VARCHAR(500)    NOT NULL DEFAULT '',
    cta_label   VARCHAR(80)     NOT NULL DEFAULT 'Shop now',
    link_to     VARCHAR(255)    NOT NULL DEFAULT '/shop',
    image_url   VARCHAR(500)    DEFAULT NULL,
    theme       ENUM('green','gold','forest') NOT NULL DEFAULT 'green',
    is_active   TINYINT(1)      NOT NULL DEFAULT 1,
    sort_order  INT             NOT NULL DEFAULT 0,
    created_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_hero_banners_active_sort (is_active, sort_order, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO legal_policies (slug, title, body, is_published, show_in_footer, sort_order) VALUES
('returns', 'Returns & refunds', 'Returns are accepted within 7 days of delivery for unused items in original packaging. Contact support before sending items back. Refunds are processed to the original payment method once goods are received and inspected.', 1, 1, 10);

INSERT IGNORE INTO legal_policies (slug, title, body, is_published, show_in_footer, sort_order) VALUES
('privacy', 'Privacy policy', 'We collect account and order information to fulfil purchases and provide support. Payment data is processed securely by Paystack. We do not sell your personal information. Contact us to request access or correction of your data.', 1, 1, 20);

INSERT IGNORE INTO legal_policies (slug, title, body, is_published, show_in_footer, sort_order) VALUES
('terms', 'Terms of service', 'By using DanyPathMart you agree to these terms. Prices are in GHS unless stated otherwise. We may update listings and policies. Continued use constitutes acceptance of changes.', 1, 1, 30);
