# Auto-deploy to Hostinger (GitHub Actions)

When you **merge to `main`**, GitHub builds the app and deploys to Hostinger over SSH — files **and** database migrations (`migrate-all.php`).

**Workflow file:** `.github/workflows/deploy-hostinger.yml`

---

## How the flow works

```
develop  →  PR  →  merge to main  →  GitHub Actions runs  →  Hostinger updated
```

| Step | What happens |
|------|----------------|
| 1 | GitHub checks out your private repo |
| 2 | Builds frontend (`npm run build`) with secrets as `VITE_*` env vars |
| 3 | Runs `composer install` for backend (uploads `vendor/` too) |
| 4 | `rsync` frontend `dist/` → `public_html/` |
| 5 | `rsync` backend → `public_html/api/` (keeps `.env` and `uploads/`) |
| 6 | SSH runs `deploy/remote-post-deploy.sh` → migrations + env check |

**`develop` branch:** does **not** auto-deploy. Work on `develop`, merge to `main` when ready for production.

**Manual deploy:** GitHub → **Actions** → **Deploy to Hostinger (production)** → **Run workflow**.

---

## Part 1 — One-time setup on Hostinger

### 1.1 SSH in and find your web root

```bash
ssh -p 65002 u161582953@82.25.113.25
```

```bash
pwd
ls -la ~
ls -la ~/domains/ 2>/dev/null || ls -la ~/public_html
```

Note the folder that contains your live site (usually one of):

- `/home/u161582953/domains/danypathmart.store/public_html`
- `/home/u161582953/public_html`

You will store this path as GitHub secret `HOSTINGER_WEB_ROOT` (no trailing slash).

### 1.2 First-time file layout (if site is not live yet)

Create API folder and production `.env` **once** (never commit `.env`):

```bash
WEB_ROOT=/home/u161582953/domains/danypathmart.store/public_html   # your path

mkdir -p "$WEB_ROOT/api"
nano "$WEB_ROOT/api/.env"
```

Copy values from `backend/.env.production.example` and fill in real DB, JWT, Paystack, SMTP passwords.

```bash
mkdir -p "$WEB_ROOT/api/uploads/products" "$WEB_ROOT/api/uploads/searches" \
  "$WEB_ROOT/api/uploads/avatars" "$WEB_ROOT/api/uploads/careers" \
  "$WEB_ROOT/api/uploads/shops" "$WEB_ROOT/api/uploads/customizations" \
  "$WEB_ROOT/api/uploads/hero" "$WEB_ROOT/api/storage/mail"
chmod -R 755 "$WEB_ROOT/api/uploads" "$WEB_ROOT/api/storage"
```

Import DB once (hPanel phpMyAdmin or SSH):

1. Create database `danypathmart` (or Hostinger prefixed name)
2. Import `database/schema.sql`
3. Import `database/seed.sql` (change default admin password before go-live)

After first successful deploy, migrations run automatically on every `main` push.

### 1.3 PHP version

hPanel → **Advanced** → **PHP Configuration** → **PHP 8.2+** for `danypathmart.store`.

---

## Part 2 — Deploy SSH key (private repo access)

GitHub Actions connects **to Hostinger** with an SSH key. You do **not** need to clone the repo on the server.

### 2.1 Generate a deploy key (on your PC)

**PowerShell:**

```powershell
ssh-keygen -t ed25519 -C "github-actions-danypathmart" -f "$env:USERPROFILE\.ssh\hostinger_deploy" -N '""'
```

This creates:

- `hostinger_deploy` — **private** → GitHub Secret
- `hostinger_deploy.pub` — **public** → Hostinger

### 2.2 Add public key to Hostinger

1. hPanel → **Advanced** → **SSH Access**
2. **SSH keys** → **Add SSH key**
3. Paste contents of `hostinger_deploy.pub`
4. Save

Test from your PC:

```powershell
ssh -p 65002 -i $env:USERPROFILE\.ssh\hostinger_deploy u161582953@82.25.113.25 "echo OK"
```

You should see `OK` without a password prompt.

---

## Part 3 — GitHub Secrets (private repo)

Repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

Add each secret:

| Secret name | Example value | Notes |
|-------------|---------------|--------|
| `HOSTINGER_SSH_HOST` | `82.25.113.25` | From Hostinger SSH page |
| `HOSTINGER_SSH_PORT` | `65002` | Hostinger SSH port |
| `HOSTINGER_SSH_USER` | `u161582953` | Your SSH username |
| `HOSTINGER_SSH_KEY` | entire private key file | Full `hostinger_deploy` including `-----BEGIN...` lines |
| `HOSTINGER_WEB_ROOT` | `/home/u161582953/domains/danypathmart.store/public_html` | **No** trailing `/` |
| `VITE_API_BASE_URL` | `https://danypathmart.store/api` | Frontend build |
| `VITE_APP_NAME` | `DanyPathMart` | Frontend build |
| `VITE_PAYSTACK_PUBLIC_KEY` | `pk_live_...` | Live Paystack public key |
| `VITE_WEBAUTHN_RP_ID` | `danypathmart.store` | No `https://` |

**`HOSTINGER_SSH_KEY` tip:** open `hostinger_deploy` in Notepad, copy **everything** (all lines).

---

## Part 4 — Merge `develop` → `main` and enable auto-deploy

### 4.1 Push the workflow to GitHub

On your PC (workflow must exist on `main`):

```powershell
cd d:\PROJECTS\danypathmart
git checkout develop
git pull origin develop
git add .github/workflows/deploy-hostinger.yml deploy/remote-post-deploy.sh DEPLOY-AUTO.md
git commit -m "Add GitHub Actions auto-deploy to Hostinger"
git push origin develop
```

Merge to `main` on GitHub:

https://github.com/danisoftdev/danypathmart/compare/main...develop

Or locally:

```powershell
git checkout main
git pull origin main
git merge develop
git push origin main
```

### 4.2 Watch the first deploy

GitHub → **Actions** → **Deploy to Hostinger (production)**

- Green = deployed
- Red = open the failed step log (usually wrong `HOSTINGER_WEB_ROOT`, SSH key, or missing `.env`)

### 4.3 Verify live site

| Check | URL |
|-------|-----|
| Homepage | https://danypathmart.store |
| Logo | https://danypathmart.store/brand/logo.png |
| API `.env` blocked | https://danypathmart.store/api/.env → **403** |

---

## Part 5 — Your day-to-day workflow

1. Code on **`develop`**
2. Commit and push: `git push origin develop`
3. Open PR **`develop` → `main`**, review, merge
4. GitHub Actions deploys automatically (2–5 minutes)
5. New SQL migrations in `database/migrations/` run via `migrate-all.php` on the server

You do **not** need to SSH or upload files manually for normal updates.

---

## What is never overwritten on deploy

| Path on server | Why |
|----------------|-----|
| `public_html/api/.env` | Production secrets — create once manually |
| `public_html/api/uploads/**` | Product images, avatars, etc. |
| `public_html/api/storage/mail/**` | Local mail dumps if SMTP off |

---

## What you still do manually

| Task | When |
|------|------|
| Create / update `public_html/api/.env` | First deploy; when adding new env vars |
| Change Paystack webhook URL | Once in Paystack dashboard |
| SSL certificate | hPanel (usually auto) |
| New `VITE_*` build variable | Add GitHub Secret, re-deploy |
| Database backup before risky migration | Best practice in hPanel |

---

## Troubleshooting

### SSH / rsync failed

- Confirm public key is in Hostinger SSH keys
- Test: `ssh -p 65002 -i ~/.ssh/hostinger_deploy u161582953@82.25.113.25`
- Check `HOSTINGER_WEB_ROOT` path exists on server
- **`Bad port '-i'`** — `HOSTINGER_SSH_PORT` secret is missing or empty. Set it to **`65002`** in GitHub → Settings → Secrets → Actions, then re-run the workflow.

### Frontend build failed

- All four `VITE_*` secrets must be set
- Check Actions log for npm errors

### Migrations failed

- SSH in: `cd $WEB_ROOT/api && php scripts/migrate-production.php`
- Confirm `.env` DB credentials match hPanel MySQL
- Ensure `schema.sql` was imported once
- **Migration 051** (promoters + subscription referral): included in `migrate-production.php` after deploy

### After deploy — subscription referral program

1. SSH: `cd ~/domains/danypathmart.store/public_html/api && php scripts/migrate-production.php`
2. Admin → **Company settings** → enable **Subscription referral program**, set **%** (super admin)
3. Admin → **Marketplace** → **Promoters** → create promoter accounts
4. Grant staff **`approve_shop_applications`** if they should approve new shops (not auto-live)
5. Promoters log in at `/promoter`; shop owners share codes from seller dashboard

### `check-production-env.php` failed

- SSH in: `cd $WEB_ROOT/api && php scripts/check-production-env.php`
- Fix missing/wrong values in `.env`

### Site shows old version

- Hard refresh browser (Ctrl+Shift+R)
- Vite assets are hashed — new deploy replaces `assets/`

### Run deploy without merging

GitHub → **Actions** → **Deploy to Hostinger (production)** → **Run workflow** → branch `main`

---

## Optional: staging from `develop` (advanced)

To auto-deploy `develop` to a separate folder/subdomain, duplicate the workflow with:

- `on.push.branches: [develop]`
- Different secrets: `HOSTINGER_WEB_ROOT_STAGING`, etc.

Not included by default — production deploys from **`main` only**.

---

## Security notes

- Never commit `.env`, `frontend/.env.production`, or SSH private keys
- Deploy key on Hostinger should be **dedicated** to GitHub Actions (not your personal key)
- Repo stays **private**; Actions uses checkout token automatically
