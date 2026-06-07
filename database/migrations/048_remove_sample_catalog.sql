-- Remove Day-2 sample catalog and default demo hero slides (hosting-ready empty storefront).

DELETE kti FROM kit_template_items kti
INNER JOIN products p ON p.id = kti.product_id
WHERE p.shop_id IS NULL
  AND p.slug IN (
    'master-guide-insignia',
    'pathfinder-class-pin-set',
    'pathfinder-field-uniform',
    'adventurer-dress-uniform',
    'honor-badge-camping',
    'honor-badge-swimming',
    'pathfinder-administration-manual',
    'pathfinder-scarf-and-slide'
  );

DELETE w FROM wishlists w
INNER JOIN products p ON p.id = w.product_id
WHERE p.shop_id IS NULL
  AND p.slug IN (
    'master-guide-insignia',
    'pathfinder-class-pin-set',
    'pathfinder-field-uniform',
    'adventurer-dress-uniform',
    'honor-badge-camping',
    'honor-badge-swimming',
    'pathfinder-administration-manual',
    'pathfinder-scarf-and-slide'
  );

DELETE FROM products
WHERE shop_id IS NULL
  AND slug IN (
    'master-guide-insignia',
    'pathfinder-class-pin-set',
    'pathfinder-field-uniform',
    'adventurer-dress-uniform',
    'honor-badge-camping',
    'honor-badge-swimming',
    'pathfinder-administration-manual',
    'pathfinder-scarf-and-slide'
  );

DELETE FROM hero_banners
WHERE title IN ('Pathfinder Season', 'Flash on Badges', 'Books & Manuals');
