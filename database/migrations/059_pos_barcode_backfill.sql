-- Assign DPM internal barcodes (DPM00000123) to catalog products missing a code.
-- Idempotent — only fills NULL/empty barcodes on DPM-owned products.

UPDATE products
SET barcode = CONCAT('DPM', LPAD(id, 8, '0'))
WHERE (shop_id IS NULL OR shop_id = 0)
  AND (barcode IS NULL OR TRIM(barcode) = '');
