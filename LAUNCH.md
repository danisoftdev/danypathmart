# DanyPathMart — Launch checklist (P0 → P2)

Use this on **staging first**, then production. Detailed deploy steps: [DEPLOY.md](./DEPLOY.md). Migrations: [database/MIGRATIONS.md](./database/MIGRATIONS.md).

---

## Phase P0 — Foundation (blocking)

Complete every item before a public URL serves customers.

### P0.1 Database

- [ ] MySQL database created in hPanel as **`danypathmart`** (`DB_NAME=danypathmart`; on Hostinger use the full prefixed name if shown, e.g. `u123456789_danypathmart`)
- [ ] **Backup** if upgrading an existing DB
- [ ] Import `database/schema.sql`
- [ ] Import `database/seed.sql` (or skip seed on prod if you create admin manually)
- [ ] Run migrations:
  ```bash
  php backend/scripts/migrate-all.php
  ```
- [ ] Confirm no errors on admin login and `GET /public/company-info`

### P0.2 Backend environment

- [ ] Copy `backend/.env.production.example` → server `public_html/api/.env`
- [ ] `APP_ENV=production`
- [ ] `DB_NAME=danypathmart` (or Hostinger prefixed equivalent)
- [ ] `APP_URL` = `https://danypathmart.store/api`
- [ ] `CORS_ORIGIN` = `https://danypathmart.store` (no trailing path)
- [ ] New `JWT_SECRET` (64+ char random hex)
- [ ] `DEV_ADMIN_BYPASS=0` (or unset)
- [ ] Paystack **live** keys + webhook URL: `https://danypathmart.store/api/payments/webhook`
- [ ] SMTP filled in (test password reset email)
- [ ] `WEBAUTHN_RP_ID` = apex domain (e.g. `danypathmart.store`)
- [ ] Run pre-flight:
  ```bash
  php backend/scripts/check-production-env.php
  ```

### P0.3 Frontend build

- [ ] Copy `frontend/.env.production.example` → `frontend/.env.production`
- [ ] Set `VITE_API_BASE_URL`, `VITE_PAYSTACK_PUBLIC_KEY`, `VITE_WEBAUTHN_RP_ID`
- [ ] **Do not** set `VITE_DEV_ADMIN_BYPASS` in production build
- [ ] `npm ci && npm run build` → upload `frontend/dist/*` to `public_html/`

### P0.4 Server hardening

- [ ] SSL (Let’s Encrypt) active
- [ ] `https://danypathmart.store/api/.env` returns **403**
- [ ] PHP **8.2+**
- [ ] Writable upload dirs (see DEPLOY.md): `products`, `searches`, `avatars`, `careers`, `shops`, `customizations`
- [ ] `composer install --no-dev` in `api/` if vendor not uploaded

### P0.5 Security defaults

- [ ] Change super admin password (not seed default `DanyPath@Admin2025!`)
- [ ] Enable 2FA for super admin before marketing (recommended)
- [ ] Remove or disable any test customer accounts on prod

### P0.6 Documentation sign-off

- [ ] Read [DEPLOY.md](./DEPLOY.md) security checklist
- [ ] Migration log noted (date + `migrate-all` run on prod)

**P0 done when:** staging site loads, admin login works, env check passes, migrations applied.

---

## Phase 1 — Go live safely (pilot + public launch)

**Goal:** Real orders work; no surprise module failures.

### Do first
- [ ] Set `PAYSTACK_SECRET_KEY` in API `.env` (test key for pilot, live for production)
- [ ] **Apply pilot preset** — Admin → Launch readiness → *Apply pilot preset*, or `php backend/scripts/pilot-preset.php`
- [ ] Run smoke tests: `pilot-smoke-test.php`, `p5-smoke-test.php`
- [ ] Complete **P1** automated checks + manual live payment + webhook
- [ ] Complete **P2** — legal policies, footer, checkout links, SEO files

**Phase 1 done when:** P1 + P2 pass; 3+ pilot orders fulfilled; extended modules off unless staffed.

---

## Phase 2 — Operate and grow

**Goal:** Turn on logistics, HR, analytics, and monitoring as you scale.

**Admin UI:** `/admin/launch-readiness` → **Phase 2 — Operate and grow**

**Requires:** Phase 1 complete (P1 + P2 automated checks passed).

### Module rollout (enable one at a time)

| Module | Admin setup after enable |
|--------|--------------------------|
| Pickup stations | `/admin/pickup-stations` |
| Driver logistics | `/admin/delivery-runs`, hub logistics |
| Station repack | `/admin/station-staff` (requires pickup) |
| Marketplace | `/admin/marketplace` |
| Careers | `/admin/job-posts` |
| Leave requests (HR) | `/admin/employees`, `/admin/leave-requests` |
| Storefront analytics | Company settings → GA4 measurement ID |

**CLI after each enable:**
```bash
php backend/scripts/p5-smoke-test.php
php backend/scripts/launch-readiness-cli.php
```

### P5 ops (when marketing starts)

- [ ] `SENTRY_DSN` in API `.env`
- [ ] Uptime monitor pinging `GET /api/health`
- [ ] GA4 Realtime confirms page views

### Weekly ops (tick in admin)

- [ ] Paystack webhook failures
- [ ] PHP error log
- [ ] Latest paid orders spot-check
- [ ] Post-deploy smoke test

**Phase 2 done when:** P3–P5 automated checks pass for every module you have enabled, and weekly ops checklist is in habit.

See sections below for P1–P5 detail.

---

## Phase P1 — Pilot commerce (blocking before ads)

**Admin UI:** [http://localhost:5173/admin/launch-readiness](http://localhost:5173/admin/launch-readiness) (automated checks + manual checklist)

**CLI:**
```bash
php backend/scripts/launch-readiness-cli.php
php backend/scripts/pilot-smoke-test.php
php backend/scripts/pilot-smoke-test.php https://danypathmart.store/api
```

### Automated (in admin)

- [ ] Active products ≥ 10
- [ ] Company: phone, email, address, hours, **return policy** (shown at `/returns`)
- [ ] Shipping % configured
- [ ] Paystack key + checkout enabled
- [ ] Migrations applied (`employees`, etc.)

### Manual (tick in admin checklist)

- [ ] Register → login → browse → add to cart → **small live payment**
- [ ] Paystack webhook updates order to paid (check admin order)
- [ ] Admin: update order status
- [ ] Shipping quote looks correct at checkout
- [ ] Password reset email (if SMTP on)

### Content

- [ ] At least 10–20 real SKUs with GHS prices
- [ ] Module toggles: only enable what you operate (see DEPLOY.md)

**P1 done when:** automated checks pass **and** 3+ real pilot orders fulfilled without manual DB edits.

---

## Phase P2 — Public launch

**Admin UI:** `/admin/launch-readiness` — P2 section (automated + manual ops checklist)

**CLI:**
```bash
php backend/scripts/launch-readiness-cli.php
```

### Automated (P2 section in admin)

- [ ] P1 pilot checks passed
- [ ] **Returns**, **privacy**, and **terms** published (`/admin/legal-policies`)
- [ ] Policies shown in footer (tick “Show in footer”)
- [ ] Checkout links returns + privacy + terms before payment
- [ ] `frontend/public/robots.txt` and `sitemap.xml` deployed with build
- [ ] Production `APP_URL` uses HTTPS

### Storefront CMS (P2)

- [ ] Hero banners managed under `/admin/hero-banners` (permissions: `view_hero_banners`, `manage_hero_banners`)
- [ ] Legal policies under `/admin/legal-policies` (permissions: `view_legal_policies`, `manage_legal_policies`)
- [ ] Public pages at `/policies/:slug` (e.g. `/policies/returns`)

### Manual (tick in admin P2 checklist)

- [ ] Daily MySQL backup scheduled
- [ ] Uptime monitoring (optional)
- [ ] Production domain + SSL verified
- [ ] No paid marketing until P2 automated checks pass

**P2 done when:** P1 complete, P2 automated checks pass, ops checklist ticked, legal visible in footer and checkout.

---

## Phase P3 — Logistics & marketplace

**Admin UI:** `/admin/launch-readiness` — P3 section

**Module toggles:** Admin → Company settings → Platform modules

| Module | Admin setup | Permissions |
|--------|-------------|-------------|
| Pickup stations | `/admin/pickup-stations` | `manage_pickup_stations` |
| Driver logistics | `/admin/delivery-runs`, `/admin/hub-logistics` | `manage_delivery_runs`, `manage_hub_logistics` |
| Station repack | `/admin/station-staff` | `manage_station_staff` |
| Marketplace | `/admin/marketplace` | `manage_marketplace`, `approve_shop_listings`, `view_shop_billing`, `manage_shop_fees`, `waive_shop_fees` |

**Planned (not built yet):** Shop registration fee + monthly/yearly renewal — see [docs/MARKETPLACE_SHOP_BILLING.md](./docs/MARKETPLACE_SHOP_BILLING.md).

### Automated (P3 section in admin)

- [ ] P2 public launch checks passed
- [ ] If **pickup stations** on → ≥1 active station
- [ ] If **station repack** on → pickup on + station staff assigned
- [ ] If **driver logistics** on → ≥1 verified driver
- [ ] If **marketplace** on → commission set + pilot shop (warn if none)

### Manual (tick in admin P3 checklist — varies by enabled modules)

- [ ] Module toggles reviewed — only enable what you operate
- [ ] Pickup checkout flow tested (if pickup on)
- [ ] Hub delivery run completed (if drivers on)
- [ ] Station repack flow tested (if repack on)
- [ ] Pilot seller listing approved (if marketplace on)

**P3 done when:** P2 complete and every **enabled** module passes its automated checks + manual smoke test.

---

## Phase P4 — Workforce HR

**Admin UI:** `/admin/employees`, `/admin/leave-requests`, `/admin/launch-readiness` (P4 section)

**Enable:** Company settings → **Workforce HR (P4)** → Leave requests

### Permissions

| Permission | Purpose |
|------------|---------|
| `view_employees` | View workforce profiles |
| `manage_employee_profiles` | Edit department, job title, emergency contact |
| `view_leave_requests` | View leave list |
| `manage_leave_requests` | Create, approve, reject leave |

### Automated (P4 section in admin)

- [ ] P3 checks passed
- [ ] Migration 045 applied (`leave_requests` table)
- [ ] If **leave requests** enabled → active employees + default annual leave days set
- [ ] Employee profiles: department or job title on most records (warn if incomplete)

### Manual

- [ ] HR permissions assigned to appropriate staff roles
- [ ] Test leave create → approve/reject workflow
- [ ] Employee emergency contacts filled for key roles

**P4 done when:** P3 complete; if HR enabled, automated P4 checks pass and manual HR smoke test done.

**Migration:** `php backend/scripts/migrate-all.php` (includes `045_employee_hr_p4.sql`)

---

## Phase P5 — Quality, monitoring & analytics

**Admin UI:** `/admin/company-settings` (Quality & ops section), `/admin/launch-readiness` (P5 section)

### Automated (P5 section in admin)

- [ ] P4 checks passed
- [ ] Migration 046 applied (analytics + uptime fields)
- [ ] `robots.txt` and `sitemap.xml` in `frontend/public`
- [ ] If **Google Analytics** enabled → valid GA4 measurement ID (`G-XXXXXXXX`)
- [ ] `p5-smoke-test.php` script available (run after deploys)

### Environment (optional but recommended in production)

- [ ] `SENTRY_DSN` in API `.env` for error alerts
- [ ] Uptime monitor pinging `GET /api/health` every 5 minutes

### Manual

- [ ] Run `php backend/scripts/p5-smoke-test.php` against staging/production
- [ ] Confirm GA4 Realtime if analytics enabled
- [ ] Review Paystack webhook + PHP logs weekly
- [ ] Repeat checkout smoke test after major releases

**P5 done when:** P4 complete; automated P5 checks pass and post-launch ops checklist ticked.

**CLI:**
```bash
php backend/scripts/p5-smoke-test.php
php backend/scripts/p5-smoke-test.php https://danypathmart.store/api
php backend/scripts/launch-readiness-cli.php
```

---

## Quick commands

| Task | Command |
|------|---------|
| All migrations | `php backend/scripts/migrate-all.php` |
| Env pre-flight | `php backend/scripts/check-production-env.php` |
| Frontend build | `cd frontend && npm run build` |
| Generate JWT secret | `php -r "echo bin2hex(random_bytes(32));"` |

---

## Rollback

1. Restore MySQL backup from before `migrate-all`.
2. Redeploy previous `frontend/dist` and `api/` snapshot.
3. Keep Paystack webhook URL consistent with live API base URL.
