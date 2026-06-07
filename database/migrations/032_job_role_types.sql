CREATE TABLE IF NOT EXISTS job_role_types (
    slug        VARCHAR(60)  NOT NULL,
    label       VARCHAR(120) NOT NULL,
    is_driver   TINYINT(1)   NOT NULL DEFAULT 0,
    created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (slug),
    UNIQUE KEY uq_job_role_types_label (label)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO job_role_types (slug, label, is_driver) VALUES
    ('driver', 'Delivery driver', 1),
    ('warehouse', 'Warehouse assistant', 0),
    ('station_coordinator', 'Pickup station coordinator', 0);

-- Widen job_type from ENUM to free-form slug (references job_role_types.slug logically).
ALTER TABLE job_posts MODIFY job_type VARCHAR(60) NOT NULL DEFAULT 'warehouse';
