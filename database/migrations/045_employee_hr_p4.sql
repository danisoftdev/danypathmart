ALTER TABLE employees ADD COLUMN IF NOT EXISTS job_title VARCHAR(120) DEFAULT NULL;

ALTER TABLE employees ADD COLUMN IF NOT EXISTS emergency_contact_name VARCHAR(120) DEFAULT NULL;

ALTER TABLE employees ADD COLUMN IF NOT EXISTS emergency_contact_phone VARCHAR(40) DEFAULT NULL;

ALTER TABLE employees ADD COLUMN IF NOT EXISTS profile_notes TEXT DEFAULT NULL;

ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS leave_requests_enabled TINYINT(1) NOT NULL DEFAULT 0;

ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS default_annual_leave_days INT UNSIGNED NOT NULL DEFAULT 21;

CREATE TABLE IF NOT EXISTS leave_requests (
    id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    employee_id     BIGINT UNSIGNED NOT NULL,
    user_id         BIGINT UNSIGNED NOT NULL,
    leave_type      ENUM('annual','sick','unpaid','other') NOT NULL DEFAULT 'annual',
    start_date      DATE            NOT NULL,
    end_date        DATE            NOT NULL,
    days_requested  DECIMAL(5,1)    NOT NULL DEFAULT 1,
    reason          TEXT            NOT NULL,
    status          ENUM('pending','approved','rejected','cancelled') NOT NULL DEFAULT 'pending',
    reviewed_by     BIGINT UNSIGNED DEFAULT NULL,
    reviewed_at     TIMESTAMP       NULL DEFAULT NULL,
    review_note     VARCHAR(500)    DEFAULT NULL,
    created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_leave_requests_status (status, start_date),
    KEY idx_leave_requests_employee (employee_id),
    CONSTRAINT fk_leave_requests_employee FOREIGN KEY (employee_id)
        REFERENCES employees (id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_leave_requests_user FOREIGN KEY (user_id)
        REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_leave_requests_reviewer FOREIGN KEY (reviewed_by)
        REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
