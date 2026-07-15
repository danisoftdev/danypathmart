-- Live chat: DPM silent watch + join, clearer routing.

SET @s = (SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'support_conversations' AND COLUMN_NAME = 'dpm_joined_at'),
    'SELECT ''skip support_conversations.dpm_joined_at'' AS info',
    'ALTER TABLE support_conversations ADD COLUMN dpm_joined_at DATETIME DEFAULT NULL AFTER bot_step_key'
));
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Allow system lines (DPM joined, connected to shop, etc.)
SET @s = (SELECT IF(
    EXISTS(
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'support_messages' AND COLUMN_NAME = 'sender_type'
          AND COLUMN_TYPE LIKE '%system%'
    ),
    'SELECT ''skip support_messages.sender_type system'' AS info',
    'ALTER TABLE support_messages MODIFY COLUMN sender_type ENUM(''customer'',''admin'',''bot'',''shop'',''system'') NOT NULL'
));
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;
