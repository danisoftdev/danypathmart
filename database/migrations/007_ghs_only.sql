-- Lock storefront to Ghana Cedis (GHS) only.
DELETE FROM currency_rates WHERE currency_code <> 'GHS';

INSERT INTO currency_rates (currency_code, currency_name, rate_to_ghs)
SELECT 'GHS', 'Ghana Cedi', 1.0000
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM currency_rates WHERE currency_code = 'GHS');

UPDATE users SET preferred_currency = 'GHS' WHERE preferred_currency <> 'GHS';
