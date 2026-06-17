# DanyPathMart — Deployment & security

- **Day-of-launch checklist:** [LAUNCH.md](./LAUNCH.md) (P0 → P2)
- **Database migrations:** [database/MIGRATIONS.md](./database/MIGRATIONS.md)
- **Auto-deploy (GitHub Actions → Hostinger):** [DEPLOY-AUTO.md](./DEPLOY-AUTO.md)

---

## Security checklist (verified in codebase)

| # | Check | Status | Evidence |
|---|--------|--------|----------|
| 1 | `WEBAUTHN_RP_ID=danypathmart.store` in production `.env` | **Configure on server** | `backend/helpers/WebAuthnService.php`; see `backend/.env.production.example` |
| 2 | `.env` returns 403 from browser | **PASS** | `backend/.htaccess` — `<Files ".env"> Require all denied` |
| 3 | `hash_equals()` for OTP & reset tokens | **PASS** | `OTPService.php`, `reset-password.php`, `confirm-change.php`, `TOTPService::verifyBackupCode`, Paystack webhook |
| 4 | DB queries use PDO prepared statements | **PASS** | User input bound via `?`; dynamic SQL only uses static fragments from `ProductQuery::filters()` |
| 5 | Super admin DELETE → 403 | **PASS** | `backend/api/admin/staff/delete.php` |
| 6 | Staff cannot PUT own permissions | **PASS** | `backend/api/admin/staff/permissions.php` |
| 7 | `GET /public/company-info` excludes `usd_to_ghs_rate` | **PASS** | `backend/api/public/company-info.php` |
| 8 | `GOOGLE_VISION_API_KEY` never in frontend responses | **PASS** | `ImageSearchService.php` |
| 9 | TOTP disable requires current TOTP code | **PASS** | `backend/api/auth/2fa/disable.php` |
| 10 | Password change revokes sessions | **PASS** | `backend/api/auth/change-password.php` |
| 11 | `DEV_ADMIN_BYPASS` off in production | **Configure** | `backend/scripts/check-production-env.php` |

---

## P0 — Database setup (required)

**Do not deploy with `schema.sql` + `seed.sql` only.** The app expects migrations through **042**.

1. Create MySQL database in hPanel named **`danypathmart`** (Hostinger may show a prefixed name like `u123456789_danypathmart` — use that full string in `DB_NAME`).
2. Import `database/schema.sql` into that database.
3. Import `database/seed.sql` (change default admin password before go-live).
4. From project root (with `backend/.env` pointing at this DB):

   ```bash
   php backend/scripts/migrate-all.php
   ```

5. On production/staging before switching DNS, backup DB then run the same command.

See [database/MIGRATIONS.md](./database/MIGRATIONS.md) for the full file list (001 → 042, M1–M8, H0 employees).

---

## Production `.env` (backend — `public_html/api/.env`)

Copy from `backend/.env.production.example` (not the dev `.env.example`):

```env
APP_ENV=production
APP_URL=https://danypathmart.store/api
CORS_ORIGIN=https://danypathmart.store
ADMIN_EMAIL=admin@danypathmart.store
DEV_ADMIN_BYPASS=0

DB_HOST=localhost
DB_NAME=danypathmart
DB_USER=your_db_user
DB_PASS=your_db_password

JWT_SECRET=<64-char random hex>
PAYSTACK_SECRET_KEY=sk_live_...
PAYSTACK_PUBLIC_KEY=pk_live_...

GOOGLE_VISION_API_KEY=<your key>

SMTP_HOST=smtp.hostinger.com
SMTP_PORT=587
SMTP_USER=noreply@danypathmart.store
SMTP_PASS=...
SMTP_FROM_NAME=DanyPathMart

WEBAUTHN_RP_ID=danypathmart.store
WEBAUTHN_RP_NAME=DanyPathMart
WEBAUTHN_ORIGIN=https://danypathmart.store
```

Pre-flight (local or SSH with production `.env`):

```bash
php backend/scripts/check-production-env.php
```

**Critical:** `WEBAUTHN_RP_ID` must match the production domain exactly (no `www`, no path).

---

## Frontend build env (`frontend/.env.production` before `npm run build`)

Copy from `frontend/.env.production.example`:

```env
VITE_API_BASE_URL=https://danypathmart.store/api
VITE_APP_NAME=DanyPathMart
VITE_PAYSTACK_PUBLIC_KEY=pk_live_...
VITE_WEBAUTHN_RP_ID=danypathmart.store
```

**Do not** set `VITE_DEV_ADMIN_BYPASS` for production builds.

---

## Hostinger deployment steps

1. **Build frontend**
   ```bash
   cd frontend
   cp .env.production.example .env.production
   # edit .env.production with live keys
   npm ci
   npm run build
   ```

2. **Upload files**
   - `frontend/dist/*` → `public_html/`
   - `deploy/public_html.htaccess` → `public_html/.htaccess`
   - Entire `backend/` folder → `public_html/api/` (include `vendor/` from `composer install --no-dev`)

3. **Composer on server** (if uploading without vendor):
   ```bash
   cd public_html/api && composer install --no-dev --optimize-autoloader
   ```

4. **Database** — see [P0 — Database setup](#p0--database-setup-required) above.

5. **Environment**
   - Create `public_html/api/.env` from `backend/.env.production.example`
   - Run `php scripts/check-production-env.php` on server
   - Verify `.env` is blocked: `https://danypathmart.store/api/.env` → **403**

6. **PHP** — hPanel → PHP Configuration → **PHP 8.2+**

7. **SSL** — hPanel → SSL → **Let's Encrypt** for `danypathmart.store`

8. **Upload directories** (writable by PHP):
   ```bash
   cd public_html/api
   mkdir -p uploads/products uploads/searches uploads/avatars uploads/careers uploads/shops uploads/customizations uploads/hero
   chmod 755 uploads uploads/products uploads/searches uploads/avatars uploads/careers uploads/shops uploads/customizations uploads/hero
   ```

9. **Paystack**
   - Dashboard → Webhooks → `https://danypathmart.store/api/payments/webhook`
   - **LIVE** `PAYSTACK_SECRET_KEY` and `VITE_PAYSTACK_PUBLIC_KEY`

10. **Post-deploy smoke tests** — see [LAUNCH.md](./LAUNCH.md) P1 section

11. **Release tag**
    ```bash
    git tag v1.0.0
    git push origin v1.0.0 --tags
    ```

---

## File layout on Hostinger

```
public_html/
├── .htaccess          ← SPA rewrite (from deploy/public_html.htaccess)
├── index.html         ← from frontend/dist/
├── assets/            ← from frontend/dist/
├── robots.txt         ← from frontend/public/robots.txt
└── api/
    ├── .htaccess      ← from backend/.htaccess
    ├── .env           ← production secrets (403 blocked)
    ├── index.php
    ├── vendor/
    └── uploads/
        ├── products/
        ├── searches/
        ├── avatars/
        ├── careers/
        ├── shops/
        └── customizations/
```

---

## Company settings module toggles (pilot)

After deploy, in **Admin → Company settings**, enable only what you operate:

| Toggle | Enable when |
|--------|-------------|
| Pickup stations | Stations exist and staff trained |
| Marketplace | Sellers ready |
| Driver / hub logistics | Hub + drivers ready |
| Station repack | Station portal in use |

Store + checkout work with all toggles off except defaults you need.
