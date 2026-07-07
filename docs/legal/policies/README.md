# DanyPathMart legal policies (CMS source)

Markdown files here are loaded into **Admin → Legal policies** by:

```bash
cd backend && php scripts/seed-legal-policies.php
```

This also runs automatically after `migrate-all.php` / production deploy.

## Slugs and URLs

| File | Slug | Public URL | Footer |
|------|------|------------|--------|
| terms.md | terms | /policies/terms | Yes |
| privacy.md | privacy | /policies/privacy | Yes |
| returns.md | returns | /policies/returns | Yes |
| payments.md | payments | /policies/payments | Yes |
| cookies.md | cookies | /policies/cookies | Yes |
| shop-seller-policy.md | shop-seller-policy | /policies/shop-seller-policy | Yes |
| acceptable-use.md | acceptable-use | /policies/acceptable-use | Yes |
| complaints-disputes.md | complaints-disputes | /policies/complaints-disputes | Yes |
| seller-handbook.md | seller-handbook | /policies/seller-handbook | No (linked from seller dashboard) |

## Editing

1. Edit the `.md` file in this folder.
2. Run the seed script (or redeploy).
3. Verify at `/policies/{slug}`.

**Note:** These are operational policies for launch. Have a qualified Ghana lawyer review before heavy marketing.

## Word documents

Older drafts live in `docs/legal/*.docx`. The markdown files above are the live CMS source for the storefront v2 model.
