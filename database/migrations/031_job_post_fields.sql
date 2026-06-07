CREATE TABLE IF NOT EXISTS job_post_fields (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    job_post_id         BIGINT UNSIGNED NOT NULL,
    field_key           VARCHAR(60)     NOT NULL,
    label               VARCHAR(200)    NOT NULL,
    field_type          ENUM('text', 'email', 'phone', 'textarea', 'number', 'select', 'file', 'url', 'date') NOT NULL DEFAULT 'text',
    is_required         TINYINT(1)      NOT NULL DEFAULT 0,
    sort_order          INT UNSIGNED    NOT NULL DEFAULT 0,
    placeholder         VARCHAR(255)    DEFAULT NULL,
    help_text           VARCHAR(500)    DEFAULT NULL,
    options_json        JSON            DEFAULT NULL,
    max_file_mb         TINYINT UNSIGNED NOT NULL DEFAULT 5,
    accepted_extensions VARCHAR(120)    NOT NULL DEFAULT 'pdf,doc,docx',
    created_at          TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_job_post_field_key (job_post_id, field_key),
    KEY idx_job_post_fields_post (job_post_id),
    KEY idx_job_post_fields_sort (job_post_id, sort_order),
    CONSTRAINT fk_job_post_fields_post FOREIGN KEY (job_post_id)
        REFERENCES job_posts (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS job_application_responses (
    id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    application_id  BIGINT UNSIGNED NOT NULL,
    field_id        BIGINT UNSIGNED DEFAULT NULL,
    field_key       VARCHAR(60)     NOT NULL,
    field_label     VARCHAR(200)    NOT NULL,
    field_type      VARCHAR(20)     NOT NULL,
    value_text      TEXT            DEFAULT NULL,
    file_path       VARCHAR(500)    DEFAULT NULL,
    file_name       VARCHAR(255)    DEFAULT NULL,
    created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_job_app_responses_app (application_id),
    KEY idx_job_app_responses_field (field_id),
    CONSTRAINT fk_job_app_responses_app FOREIGN KEY (application_id)
        REFERENCES job_applications (id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_job_app_responses_field FOREIGN KEY (field_id)
        REFERENCES job_post_fields (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE job_applications
    MODIFY name VARCHAR(120) DEFAULT NULL,
    MODIFY email VARCHAR(190) DEFAULT NULL,
    MODIFY phone VARCHAR(40) DEFAULT NULL,
    MODIFY cover_message TEXT DEFAULT NULL;
