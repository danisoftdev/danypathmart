-- OAuth / social login identities
ALTER TABLE users
    MODIFY password_hash VARCHAR(255) DEFAULT NULL;

CREATE TABLE IF NOT EXISTS oauth_identities (
    id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id          BIGINT UNSIGNED NOT NULL,
    provider         ENUM('google','microsoft','apple') NOT NULL,
    provider_user_id VARCHAR(255)    NOT NULL,
    email            VARCHAR(190)      DEFAULT NULL,
    created_at       TIMESTAMP         NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_oauth_provider_user (provider, provider_user_id),
    KEY idx_oauth_user (user_id),
    CONSTRAINT fk_oauth_user FOREIGN KEY (user_id)
        REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS oauth_states (
    state      VARCHAR(64) NOT NULL,
    provider   VARCHAR(20) NOT NULL,
    expires_at DATETIME    NOT NULL,
    PRIMARY KEY (state),
    KEY idx_oauth_states_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS oauth_tickets (
    ticket     VARCHAR(64)     NOT NULL,
    user_id    BIGINT UNSIGNED NOT NULL,
    expires_at DATETIME        NOT NULL,
    PRIMARY KEY (ticket),
    KEY idx_oauth_tickets_expires (expires_at),
    CONSTRAINT fk_oauth_tickets_user FOREIGN KEY (user_id)
        REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
