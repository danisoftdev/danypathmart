-- Remove approved shop applications left behind after shop hard-delete
-- (older FK was ON DELETE SET NULL, so apps could outlive the shop).
-- Idempotent — safe to re-run.

DELETE FROM shop_applications
WHERE status = 'approved'
  AND shop_id IS NULL;
