# Marketplace shop billing

**Status: implemented** (migration `047_shop_billing_m6.sql`)

Shop sellers pay a **registration fee** when applying and **renewal fees** on a monthly or yearly cycle set by admin. Payments go through **Paystack** (card + mobile money).

## Permissions

| Permission | Purpose |
|---|---|
| `view_shop_billing` | View fee settings, payment history, renewal status |
| `manage_shop_fees` | Enable/disable billing, set registration & renewal amounts, period, grace days |
| `waive_shop_fees` | Waive registration on an application or renewal for a shop |

Assign under **Admin → Positions → Marketplace**.

## Admin configuration

1. Enable **Marketplace / shops** and **Open shop applications** in Company settings.
2. With `manage_shop_fees`, enable **Shop billing** and set fees + renewal period (monthly/yearly).
3. Review payments and subscriptions on **Admin → Marketplace → Billing** tab.

## Flow

- **Apply:** Applicant submits form → if billing enabled and registration fee > 0, status is `pending_payment` until Paystack succeeds → then `new` for admin review.
- **Approve:** Admin approves only after fee paid or waived; subscription period starts.
- **Renew:** Seller pays from seller dashboard banner when subscription lapses; shop hidden from public listings until renewed or waived.

## API (summary)

- `GET public/shop-billing/settings`
- `POST public/shop-billing/initialize-registration`
- `POST shop/billing/initialize-renewal`
- `GET admin/shop-billing` — settings, payments, subscriptions
- `POST admin/shop-billing/update-settings` — requires `manage_shop_fees`
- `POST admin/shop-billing/waive-application` / `waive-shop` — requires `waive_shop_fees`

Paystack webhook handles `metadata.billing_type` of `shop_registration` or `shop_renewal`.
