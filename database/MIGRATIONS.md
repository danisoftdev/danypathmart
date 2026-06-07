# Database migrations

`schema.sql` is the **base** schema. Feature work through M8, employees (H0), and staff ID format (042) lives in **`migrations/`** and must be applied on every environment.

## Fresh database (recommended order)

1. Create empty MySQL database named **`danypathmart`** (production default; Hostinger may prefix it — use the exact name from hPanel in `DB_NAME`).
2. Import `database/schema.sql`.
3. Import `database/seed.sql` (super admin + defaults — **change password before production**).
4. Run all migrations:
   ```bash
   php backend/scripts/migrate-all.php
   ```

## Existing database (already on schema + seed)

Run only step 4. Safe to re-run: duplicate column/table errors are skipped.

## Migration files (numeric order)

| File | Phase | Summary |
|------|-------|---------|
| `001_inventory_cost_fields.sql` | — | Product cost fields |
| `002_product_merchandising.sql` | — | Featured, flash, badges |
| `003_flash_sale_settings.sql` | — | Flash sale settings |
| `004_notifications_wishlist.sql` | — | Notifications, wishlist |
| `005_contact_messages.sql` | — | Contact inbox |
| `006_oauth_identities.sql` | — | Social login |
| `007_ghs_only.sql` | — | GHS currency |
| `008_wallet_payments.sql` | — | Wallet |
| `009_order_pending_cancel.sql` | — | Order cancel window |
| `010_phase_b_checkout.sql` | B | Checkout |
| `011_phase_c_sizing.sql` | C | Sizing |
| `012_phase_d_kit_builder.sql` | D | Kits |
| `013_phase_e_group_institutional.sql` | E | Group orders |
| `030_job_careers_m2.sql` | M2 | Careers |
| `031_job_post_fields.sql` | M2 | Job post fields |
| `032_job_role_types.sql` | M2 | Role types catalog |
| `033_position_permissions_hire.sql` | M2 | Hire + permissions |
| `034_pickup_stations_m3.sql` | M3 | Pickup stations |
| `035_marketplace_m4.sql` | M4 | Marketplace shops |
| `036_shop_application_logo.sql` | M4 | Shop application logo |
| `037_shop_referrals_m5.sql` | M5 | Referrals |
| `038_shop_promo_badges_m6.sql` | M6 | Promo badges |
| `039_hub_logistics_m7.sql` | M7 | Hub, drivers, delivery runs |
| `040_station_repack_m8.sql` | M8 | Station repack |
| `041_employee_staff_ids.sql` | H0 | Employees + DPM-EMP IDs |
| `042_staff_id_shorter_digits.sql` | H0 | 4-digit staff ID format |
| `043_storefront_cms.sql` | P2 | Hero banners, legal policies |
| `044_storefront_cms_repair.sql` | P2 | CMS repair / idempotent fixes |
| `045_employee_hr_p4.sql` | P4 | Employee profiles, leave requests, HR settings |
| `046_ops_monitoring_p5.sql` | P5 | Analytics toggle, GA ID, uptime monitor URL |
| `047_shop_billing_m6.sql` | M6 | Shop registration & renewal billing |
| `048_remove_sample_catalog.sql` | — | Remove seed sample products & demo hero banners |

`migrate-all.php` also runs post-hooks: job role catalog sync, workforce employee backfill.

## Legacy per-phase scripts

Individual `backend/scripts/migrate-phase-*.php` files remain for debugging; **`migrate-all.php` is the canonical path** for deploys.

## Production backup

Before `migrate-all` on production:

```bash
# hPanel → Backups, or mysqldump
mysqldump -u USER -p DB_NAME > backup_$(date +%Y%m%d).sql
```
