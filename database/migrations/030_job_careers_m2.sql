CREATE TABLE IF NOT EXISTS job_posts (
    id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    title       VARCHAR(200)    NOT NULL,
    city        VARCHAR(120)    NOT NULL,
    job_type    ENUM('driver', 'warehouse', 'station_coordinator') NOT NULL DEFAULT 'driver',
    description TEXT            NOT NULL,
    is_active   TINYINT(1)      NOT NULL DEFAULT 1,
    created_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_job_posts_active (is_active),
    KEY idx_job_posts_type (job_type),
    KEY idx_job_posts_city (city)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS job_applications (
    id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    job_post_id   BIGINT UNSIGNED DEFAULT NULL,
    job_title     VARCHAR(200)    NOT NULL,
    user_id       BIGINT UNSIGNED DEFAULT NULL,
    name          VARCHAR(120)    NOT NULL,
    email         VARCHAR(190)    NOT NULL,
    phone         VARCHAR(40)     NOT NULL,
    city          VARCHAR(120)    DEFAULT NULL,
    cover_message TEXT            NOT NULL,
    is_read       TINYINT(1)      NOT NULL DEFAULT 0,
    created_at    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_job_applications_read (is_read),
    KEY idx_job_applications_created (created_at),
    KEY idx_job_applications_post (job_post_id),
    KEY idx_job_applications_user (user_id),
    CONSTRAINT fk_job_applications_post FOREIGN KEY (job_post_id)
        REFERENCES job_posts (id) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_job_applications_user FOREIGN KEY (user_id)
        REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
