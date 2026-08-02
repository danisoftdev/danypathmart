-- Top-level storefront categories (idempotent: skip if name or slug already exists).

INSERT INTO categories (name, slug, description, parent_id)
SELECT 'Sports & Outdoor', 'sports-outdoor', NULL, NULL
FROM DUAL
WHERE NOT EXISTS (
    SELECT 1 FROM categories c
    WHERE c.parent_id IS NULL AND LOWER(c.name) = LOWER('Sports & Outdoor')
)
AND NOT EXISTS (SELECT 1 FROM categories c WHERE c.slug = 'sports-outdoor');

INSERT INTO categories (name, slug, description, parent_id)
SELECT 'Stationery & Office', 'stationery-office', NULL, NULL
FROM DUAL
WHERE NOT EXISTS (
    SELECT 1 FROM categories c
    WHERE c.parent_id IS NULL AND LOWER(c.name) = LOWER('Stationery & Office')
)
AND NOT EXISTS (SELECT 1 FROM categories c WHERE c.slug = 'stationery-office');

INSERT INTO categories (name, slug, description, parent_id)
SELECT 'Tools & Hardware', 'tools-hardware', NULL, NULL
FROM DUAL
WHERE NOT EXISTS (
    SELECT 1 FROM categories c
    WHERE c.parent_id IS NULL AND LOWER(c.name) = LOWER('Tools & Hardware')
)
AND NOT EXISTS (SELECT 1 FROM categories c WHERE c.slug = 'tools-hardware');

INSERT INTO categories (name, slug, description, parent_id)
SELECT 'Travel & Luggage', 'travel-luggage', NULL, NULL
FROM DUAL
WHERE NOT EXISTS (
    SELECT 1 FROM categories c
    WHERE c.parent_id IS NULL AND LOWER(c.name) = LOWER('Travel & Luggage')
)
AND NOT EXISTS (SELECT 1 FROM categories c WHERE c.slug = 'travel-luggage');

INSERT INTO categories (name, slug, description, parent_id)
SELECT 'Industrial & Wholesale', 'industrial-wholesale', NULL, NULL
FROM DUAL
WHERE NOT EXISTS (
    SELECT 1 FROM categories c
    WHERE c.parent_id IS NULL AND LOWER(c.name) = LOWER('Industrial & Wholesale')
)
AND NOT EXISTS (SELECT 1 FROM categories c WHERE c.slug = 'industrial-wholesale');

INSERT INTO categories (name, slug, description, parent_id)
SELECT 'Music & Instruments', 'music-instruments', NULL, NULL
FROM DUAL
WHERE NOT EXISTS (
    SELECT 1 FROM categories c
    WHERE c.parent_id IS NULL AND LOWER(c.name) = LOWER('Music & Instruments')
)
AND NOT EXISTS (SELECT 1 FROM categories c WHERE c.slug = 'music-instruments');

INSERT INTO categories (name, slug, description, parent_id)
SELECT 'Office & Business', 'office-business', NULL, NULL
FROM DUAL
WHERE NOT EXISTS (
    SELECT 1 FROM categories c
    WHERE c.parent_id IS NULL AND LOWER(c.name) = LOWER('Office & Business')
)
AND NOT EXISTS (SELECT 1 FROM categories c WHERE c.slug = 'office-business');

INSERT INTO categories (name, slug, description, parent_id)
SELECT 'Pathfinder & Adventurer', 'pathfinder-adventurer', NULL, NULL
FROM DUAL
WHERE NOT EXISTS (
    SELECT 1 FROM categories c
    WHERE c.parent_id IS NULL AND LOWER(c.name) = LOWER('Pathfinder & Adventurer')
)
AND NOT EXISTS (SELECT 1 FROM categories c WHERE c.slug = 'pathfinder-adventurer');

INSERT INTO categories (name, slug, description, parent_id)
SELECT 'Pets', 'pets', NULL, NULL
FROM DUAL
WHERE NOT EXISTS (
    SELECT 1 FROM categories c
    WHERE c.parent_id IS NULL AND LOWER(c.name) = LOWER('Pets')
)
AND NOT EXISTS (SELECT 1 FROM categories c WHERE c.slug = 'pets');
