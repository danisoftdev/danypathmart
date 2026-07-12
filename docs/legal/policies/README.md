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

**Note:** DPM is currently operated as an **online business** at **https://danypathmart.store** and is **not yet formally registered** in Ghana. Policies reflect that status and will be updated when registration is completed. Have a qualified Ghana lawyer review before heavy marketing or formal registration.

## Word documents

Regenerate `.docx` files from the markdown source:

```bash
python docs/legal/generate_legal_docs.py
```

Output: `docs/legal/word/` (always). Files are also copied to `docs/legal/*.docx` when not open in Word.

| Word file | Markdown source |
|-----------|-----------------|
| 01_Terms_and_Conditions.docx | terms.md |
| 02_Privacy_Policy.docx | privacy.md |
| 03_Cookies_Policy.docx | cookies.md |
| 04_Shop_Seller_Policy.docx | shop-seller-policy.md |
| 05_Payment_Policy.docx | payments.md |
| 06_Returns_and_Refunds_Policy.docx | returns.md |
| 07_Acceptable_Use_Policy.docx | acceptable-use.md |
| 08_Complaints_and_Disputes.docx | complaints-disputes.md |
| 09_Seller_Handbook.docx | seller-handbook.md |

Older drafts may also exist in `docs/legal/*.docx`. The markdown files above are the live CMS source for the storefront v2 model.
