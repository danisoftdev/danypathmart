# DanyPathMart — Day 5B Security Audit & Deployment

## Security checklist (verified in codebase)

| # | Check | Status | Evidence |
|---|--------|--------|----------|
| 1 | `WEBAUTHN_RP_ID=danypathmart.com` in production `.env` | **Configure on server** | `backend/helpers/WebAuthnService.php`; see `backend/.env.example` production block |
| 2 | `.env` returns 403 from browser | **PASS** | `backend/.htaccess` — `<Files ".env"> Require all denied` |
| 3 | `hash_equals()` for OTP & reset tokens | **PASS** | `OTPService.php`, `reset-password.php`, `confirm-change.php`, `TOTPService::verifyBackupCode`, Paystack webhook |
| 4 | DB queries use PDO prepared statements | **PASS** | User input bound via `?`; dynamic SQL only uses static fragments from `ProductQuery::filters()` |
| 5 | Super admin DELETE → 403 | **PASS** | `backend/api/admin/staff/delete.php` line 26–27 |
| 6 | Staff cannot PUT own permissions | **PASS** | `backend/api/admin/staff/permissions.php` — `$targetId === (int) $admin['id']` → 422 |
| 7 | `GET /public/company-info` excludes `usd_to_ghs_rate` | **PASS** | `backend/api/public/company-info.php` — column not selected |
| 8 | `GOOGLE_VISION_API_KEY` never in frontend responses | **PASS** | Server-only in `ImageSearchService.php`; API returns `labels` / `products` only |
| 9 | TOTP disable requires current TOTP code | **PASS** | `backend/api/auth/2fa/disable.php` — `TOTPService::verify()` before UPDATE |
| 10 | Password change revokes sessions | **PASS** | `backend/api/auth/change-password.php` — `DELETE FROM user_sessions WHERE user_id = ?` |

---

## Production `.env` (backend — `public_html/api/.env`)

Copy from `backend/.env.example` and set at minimum:

```env
APP_ENV=production
APP_URL=https://danypathmart.com/api
CORS_ORIGIN=https://danypathmart.com
ADMIN_EMAIL=admin@danypathmart.com

DB_HOST=localhost
DB_NAME=your_db_name
DB_USER=your_db_user
DB_PASS=your_db_password

JWT_SECRET=<256-bit random hex>
PAYSTACK_SECRET_KEY=sk_live_...
PAYSTACK_PUBLIC_KEY=pk_live_...

GOOGLE_VISION_API_KEY=<your key>

SMTP_HOST=smtp.hostinger.com
SMTP_PORT=587
SMTP_USER=noreply@danypathmart.com
SMTP_PASS=...
SMTP_FROM_NAME=DanyPathMart

WEBAUTHN_RP_ID=danypathmart.com
WEBAUTHN_RP_NAME=DanyPathMart
WEBAUTHN_ORIGIN=https://danypathmart.com
```

**Critical:** `WEBAUTHN_RP_ID` must match the production domain exactly (no `www`, no path).

---

## Frontend build env (`frontend/.env.production` before `npm run build`)

```env
VITE_API_BASE_URL=https://danypathmart.com/api
VITE_APP_NAME=DanyPathMart
VITE_PAYSTACK_PUBLIC_KEY=pk_live_...
VITE_WEBAUTHN_RP_ID=danypathmart.com
```

---

## Hostinger deployment steps

1. **Build frontend**
   ```bash
   cd frontend
   cp .env.production .env   # or export vars inline
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

4. **Database**
   - Create MySQL database in hPanel
   - Import `database/schema.sql`
   - Import `database/seed.sql` (super admin + sample data)

5. **Environment**
   - Create `public_html/api/.env` with production values (see above)
   - Verify `.env` is blocked: open `https://danypathmart.com/api/.env` → expect **403**

6. **PHP**
   - hPanel → PHP Configuration → **PHP 8.2**

7. **SSL**
   - hPanel → SSL → **Let's Encrypt** for `danypathmart.com`

8. **Upload directories** (writable by PHP):
   ```bash
   mkdir -p public_html/api/uploads/products public_html/api/uploads/searches
   chmod 755 public_html/api/uploads public_html/api/uploads/products public_html/api/uploads/searches
   ```

9. **Paystack**
   - Dashboard → Webhooks → `https://danypathmart.com/api/payments/webhook`
   - Switch to **LIVE** `PAYSTACK_SECRET_KEY` and `VITE_PAYSTACK_PUBLIC_KEY`

10. **Post-deploy smoke tests**
    - Homepage loads products
    - Register / login / checkout (live card + MTN MoMo)
    - Admin login → staff CRUD
    - Image search (no API key in network tab responses)
    - 2FA enable/disable (requires TOTP to disable)

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
        └── searches/
```
