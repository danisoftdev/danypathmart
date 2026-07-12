-- Password reset: store opaque magic-link token hash alongside OTP code hash.
-- Idempotent — safe to re-run.

SET @s = (SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'email_verifications' AND COLUMN_NAME = 'token_hash'),
    'SELECT ''skip email_verifications.token_hash'' AS info',
    'ALTER TABLE email_verifications ADD COLUMN token_hash CHAR(64) DEFAULT NULL AFTER otp_hash'
));
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @s = (SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'email_verifications' AND INDEX_NAME = 'idx_email_verifications_token'),
    'SELECT ''skip idx_email_verifications_token'' AS info',
    'ALTER TABLE email_verifications ADD KEY idx_email_verifications_token (token_hash)'
));
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;
