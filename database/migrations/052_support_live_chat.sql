-- Two-way support live chat (storefront widget + admin replies). Contact form inbox unchanged.

CREATE TABLE IF NOT EXISTS support_conversations (
    id                      BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id                 BIGINT UNSIGNED DEFAULT NULL,
    guest_token             VARCHAR(64)     DEFAULT NULL,
    guest_name              VARCHAR(120)    DEFAULT NULL,
    guest_email             VARCHAR(190)    DEFAULT NULL,
    status                  ENUM('open','closed') NOT NULL DEFAULT 'open',
    admin_unread_count      INT UNSIGNED    NOT NULL DEFAULT 0,
    customer_unread_count   INT UNSIGNED    NOT NULL DEFAULT 0,
    last_message_at         TIMESTAMP       NULL DEFAULT NULL,
    created_at              TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_support_guest_token (guest_token),
    KEY idx_support_conv_user (user_id),
    KEY idx_support_conv_status (status, last_message_at),
    CONSTRAINT fk_support_conv_user FOREIGN KEY (user_id)
        REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS support_messages (
    id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    conversation_id BIGINT UNSIGNED NOT NULL,
    sender_type     ENUM('customer','admin') NOT NULL,
    sender_user_id  BIGINT UNSIGNED DEFAULT NULL,
    body            TEXT            DEFAULT NULL,
    image_url       VARCHAR(500)    DEFAULT NULL,
    created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_support_messages_conv (conversation_id, id),
    CONSTRAINT fk_support_messages_conv FOREIGN KEY (conversation_id)
        REFERENCES support_conversations (id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_support_messages_sender FOREIGN KEY (sender_user_id)
        REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
