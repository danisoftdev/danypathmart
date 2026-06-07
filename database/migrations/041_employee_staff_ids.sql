-- Phase H0: workforce employee records with auto staff IDs (DPM-EMP-####)

CREATE TABLE IF NOT EXISTS staff_id_sequences (
    id         TINYINT UNSIGNED NOT NULL DEFAULT 1,
    next_value INT UNSIGNED     NOT NULL DEFAULT 1,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO staff_id_sequences (id, next_value) VALUES (1, 1);

CREATE TABLE IF NOT EXISTS employees (
    id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id         BIGINT UNSIGNED NOT NULL,
    staff_id        VARCHAR(20)     NOT NULL,
    manager_user_id BIGINT UNSIGNED DEFAULT NULL,
    department      VARCHAR(120)    DEFAULT NULL,
    employment_type ENUM('full_time','part_time','contract') DEFAULT NULL,
    start_date      DATE            DEFAULT NULL,
    status          ENUM('active','inactive') NOT NULL DEFAULT 'active',
    created_by      BIGINT UNSIGNED DEFAULT NULL,
    created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_employees_user (user_id),
    UNIQUE KEY uq_employees_staff_id (staff_id),
    KEY idx_employees_manager (manager_user_id),
    KEY idx_employees_status (status),
    CONSTRAINT fk_employees_user FOREIGN KEY (user_id)
        REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_employees_manager FOREIGN KEY (manager_user_id)
        REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_employees_created_by FOREIGN KEY (created_by)
        REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
