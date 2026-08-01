-- Promoter applications (public apply) + first-login password change flag.
-- Idempotent — safe to re-run.

SET @s = (SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'must_change_password'),
    'SELECT ''skip users.must_change_password'' AS info',
    'ALTER TABLE users ADD COLUMN must_change_password TINYINT(1) NOT NULL DEFAULT 0 AFTER totp_enabled'
));
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS promoter_applications (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(190) NOT NULL,
  phone VARCHAR(40) NULL,
  city VARCHAR(120) NULL,
  experience TEXT NULL,
  why_join TEXT NULL,
  status ENUM('new', 'approved', 'rejected') NOT NULL DEFAULT 'new',
  admin_note VARCHAR(500) NULL,
  created_user_id INT UNSIGNED NULL,
  promoter_id INT UNSIGNED NULL,
  reviewed_by INT UNSIGNED NULL,
  reviewed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_promoter_apps_status (status, created_at),
  INDEX idx_promoter_apps_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
