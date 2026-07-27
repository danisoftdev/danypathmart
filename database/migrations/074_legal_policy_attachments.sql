-- Downloadable attachment for legal policies (e.g. Seller Handbook Word/PDF).
-- Idempotent.

SET @s = (SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'legal_policies' AND COLUMN_NAME = 'attachment_path'),
    'SELECT ''skip legal_policies.attachment_path'' AS info',
    'ALTER TABLE legal_policies
       ADD COLUMN attachment_path VARCHAR(500) DEFAULT NULL AFTER sort_order,
       ADD COLUMN attachment_name VARCHAR(255) DEFAULT NULL AFTER attachment_path'
));
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;
