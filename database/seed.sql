-- =============================================================================
-- DanyPathMart — Seed Data
-- Run AFTER schema.sql (phpMyAdmin -> Import) on the danypathmart database.
-- -----------------------------------------------------------------------------
-- Super admin login (CHANGE ALL THREE BEFORE GOING LIVE — see security checklist)
--   email:    admin@danypathmart.store
--   username: superadmin
--   password: DanyPath@Admin2025!
-- Bcrypt hash below was generated with:
--   php -r "echo password_hash('DanyPath@Admin2025!', PASSWORD_BCRYPT, ['cost'=>12]);"
-- =============================================================================

SET NAMES utf8mb4;

-- -----------------------------------------------------------------------------
-- 1. Super admin account (role=super_admin, status=verified, totp_enabled=0)
-- -----------------------------------------------------------------------------
INSERT INTO users (name, username, email, password_hash, role, status, preferred_currency, totp_enabled)
VALUES (
    'Super Admin',
    'superadmin',
    'admin@danypathmart.store',
    '$2y$12$9ZA4fDCJMubBZGyW61iOw.You83WMa8R/j0YboRrP9deHT0kATyfu',
    'super_admin',
    'verified',
    'GHS',
    0
);

SET @admin_id = LAST_INSERT_ID();

-- -----------------------------------------------------------------------------
-- 2. Company settings (single row, id=1) — shown site-wide in footer/emails
-- -----------------------------------------------------------------------------
INSERT INTO company_settings (
    company_name, email, phone, whatsapp_support, address, business_hours,
    return_policy, usd_to_ghs_rate, updated_by
) VALUES (
    'DanyPathMart',
    'support@danypathmart.store',
    '+233000000000',
    '+233000000000',
    'Accra, Ghana',
    'Mon-Fri 8am-6pm, Sat 9am-2pm',
    'Returns accepted within 7 days of delivery for unused items in original packaging.',
    15.5000,
    @admin_id
);

-- -----------------------------------------------------------------------------
-- 3. Shipping settings (single row) — base local delivery percentage
-- -----------------------------------------------------------------------------
INSERT INTO shipping_settings (local_delivery_base_percent, updated_by)
VALUES (5.00, @admin_id);

-- -----------------------------------------------------------------------------
-- 4. Currency (GHS only — storefront charges in Ghana Cedis)
-- -----------------------------------------------------------------------------
INSERT INTO currency_rates (currency_code, currency_name, rate_to_ghs) VALUES
    ('GHS', 'Ghana Cedi', 1.0000);

-- -----------------------------------------------------------------------------
-- 5. Sample top-level categories
-- -----------------------------------------------------------------------------
INSERT INTO categories (name, slug, description) VALUES
    ('Insignias',  'insignias',  'SDA youth rank insignias and emblems'),
    ('Uniforms',   'uniforms',   'Pathfinder and Adventurer uniforms'),
    ('Badges',     'badges',     'Rank and honor badges'),
    ('Books',      'books',      'Guides, manuals and educational materials'),
    ('Accessories','accessories','Scarves, slides, sashes and more');

-- -----------------------------------------------------------------------------
-- 6. Default super_admin permissions row (all 15 toggles ON for the owner)
-- -----------------------------------------------------------------------------
INSERT INTO staff_permissions (user_id, role_name, permissions, created_by)
VALUES (
    @admin_id,
    'Super Admin',
    JSON_OBJECT(
        'view_orders', true,
        'edit_orders', true,
        'view_products', true,
        'add_edit_products', true,
        'delete_products', true,
        'view_users', true,
        'edit_users', true,
        'view_reports', true,
        'manage_categories', true,
        'manage_shipping', true,
        'manage_staff', true,
        'view_company_settings', true,
        'edit_company_settings', true,
        'view_image_alerts', true,
        'manage_image_alerts', true
    ),
    @admin_id
);

-- =============================================================================
-- End of seed data (no sample products — add catalog via Admin → Products)
-- =============================================================================