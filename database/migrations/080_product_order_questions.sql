-- Optional MCQ questions shoppers answer when ordering a product.

SET @db = DATABASE();

SET @sql = IF(
    EXISTS(
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'products' AND COLUMN_NAME = 'order_questions'
    ),
    'SELECT ''skip products.order_questions'' AS info',
    'ALTER TABLE products ADD COLUMN order_questions JSON DEFAULT NULL AFTER requires_custom_proof'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
