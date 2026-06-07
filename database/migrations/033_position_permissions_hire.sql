CREATE TABLE IF NOT EXISTS position_permission_templates (
    role_slug   VARCHAR(60)  NOT NULL,
    permissions JSON         NOT NULL,
    updated_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (role_slug),
    CONSTRAINT fk_position_perm_role FOREIGN KEY (role_slug)
        REFERENCES job_role_types (slug) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE job_applications
    ADD COLUMN hired_user_id BIGINT UNSIGNED DEFAULT NULL AFTER user_id,
    ADD COLUMN hired_at TIMESTAMP NULL DEFAULT NULL AFTER hired_user_id;

ALTER TABLE job_applications
    ADD KEY idx_job_applications_hired (hired_user_id);

ALTER TABLE job_applications
    ADD CONSTRAINT fk_job_applications_hired_user FOREIGN KEY (hired_user_id)
        REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE;
