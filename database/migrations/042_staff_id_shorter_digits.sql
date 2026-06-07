-- Shorten staff IDs from DPM-EMP-000001 to DPM-EMP-0001 (4-digit suffix)

UPDATE employees
SET staff_id = CONCAT('DPM-EMP-', LPAD(CAST(SUBSTRING(staff_id, 9) AS UNSIGNED), 4, '0'))
WHERE staff_id LIKE 'DPM-EMP-%'
  AND LENGTH(staff_id) > 12;
