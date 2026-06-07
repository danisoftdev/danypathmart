CREATE TABLE IF NOT EXISTS contact_messages (
    id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id    BIGINT UNSIGNED DEFAULT NULL,
    name       VARCHAR(120)    NOT NULL,
    email      VARCHAR(190)    NOT NULL,
    subject    VARCHAR(200)    DEFAULT NULL,
    message    TEXT            NOT NULL,
    is_read    TINYINT(1)      NOT NULL DEFAULT 0,
    created_at TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_contact_messages_read (is_read),
    KEY idx_contact_messages_created (created_at),
    KEY idx_contact_messages_user (user_id),
    CONSTRAINT fk_contact_messages_user FOREIGN KEY (user_id)
        REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
