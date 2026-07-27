-- Optional social links on About team member cards (idempotent)

SET @s = (SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'about_team_members' AND COLUMN_NAME = 'linkedin_url'),
    'SELECT ''skip about_team_members.linkedin_url'' AS info',
    'ALTER TABLE about_team_members ADD COLUMN linkedin_url VARCHAR(500) NOT NULL DEFAULT '''' AFTER photo_url'
));
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @s = (SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'about_team_members' AND COLUMN_NAME = 'website_url'),
    'SELECT ''skip about_team_members.website_url'' AS info',
    'ALTER TABLE about_team_members ADD COLUMN website_url VARCHAR(500) NOT NULL DEFAULT '''' AFTER linkedin_url'
));
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;
