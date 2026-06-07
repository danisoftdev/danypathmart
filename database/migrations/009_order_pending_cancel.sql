-- Pending fulfillment status + cancellation metadata
ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS cancelled_by ENUM('customer','admin') DEFAULT NULL AFTER notes,
    ADD COLUMN IF NOT EXISTS cancel_reason VARCHAR(500) DEFAULT NULL AFTER cancelled_by;

-- MySQL 8 may not support IF NOT EXISTS on columns; migration script handles idempotency.
