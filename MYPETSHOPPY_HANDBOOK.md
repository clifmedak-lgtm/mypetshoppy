# MyPetshoppy — Project Handbook

Your reference for the whole site: what exists, how it works, and how to manage the database
safely. Keep this file in the project folder and update it when things change.

---

## 1. Architecture

```
Browser (HTML + Tailwind + app.js)
        |
        v
Express server (server.js)  <-- also exposed as api/server.js for Vercel
        |
        v
Prisma ORM  -->  PostgreSQL database on Neon
        |
        v
NotchPay (payments in AND payouts out) · Brevo (email) · Cloudinary (photos)
```

| File | Role |
|---|---|
| `server.js` | The entire backend: all API routes, auth, orders, payments, payouts |
| `api/server.js` | Tiny re-export so Vercel runs `server.js` as a serverless function |
| `prisma/schema.prisma` | Database structure — the source of truth |
| `prisma/seed.js` | Demo listings to start with |
| `app.js` | All storefront logic: cart, search, checkout, reviews, wishlist, flash sale, carousel |
| `index.html` | Homepage: flash sale, best-sellers carousel, category filters, search, listings grid |
| `product.html` | Single listing + reviews + wishlist |
| `checkout.html` | Shipping form, payment method, coupon, order summary |
| `account.html` | Customer login/register, order history, wishlist, password reset |
| `reset-password.html` | Where the emailed reset link lands |
| `vendor-dashboard.html` | Seller: listings CRUD, orders, balance, Mobile Money setup (self-contained JS) |
| `admin.html` | Admin: stats, customers, sellers, listings, orders, coupons, payouts (self-contained JS) |
| `admin-tools.mjs` | Command-line admin tasks (password resets, coupons, debugging) |

---

## 2. What the site does

**Customers:** browse by category (dogs, cats, small pets, food, toys, accessories), search by
name/breed/seller, filter by price, flash-sale section, auto-rotating best-sellers carousel,
cart, wishlist, reviews with "verified purchase" badges, checkout with coupon support,
order history, self-service password reset.

**Sellers:** register/login, create listings with photo drag-and-drop, breed and age fields
(for live animals), long descriptions plus bullet "key features", stock quantity, see orders
with customer details, update order status, see net earnings and available balance, register
their own MTN/Orange Money number for payouts.

**Admin (`admin.html`, password = `ADMIN_SECRET`):** platform stats and revenue, customer
list with spend, seller list with amounts owed, one-click real Mobile Money payouts, listing
moderation, all orders with payment references, coupon creation and management.

---

## 3. Order & payment lifecycle

Two independent statuses:

| `status` (fulfillment) | `paymentStatus` |
|---|---|
| `PENDING_PAYMENT` | `UNPAID` |
| `PROCESSING` | `PAID` |
| `SHIPPED` / `DELIVERED` | `PAID` |
| `CANCELLED` | `UNPAID` or `FAILED` |

1. `POST /api/checkout` → order created `PENDING_PAYMENT` / `UNPAID`, stock checked, coupon validated
2. `POST /api/payment/initiate` → NotchPay returns a payment URL, browser redirects there
3. Customer pays
4. Confirmation happens two ways (both implemented, so it works locally too):
   - **Webhook:** NotchPay calls `POST /api/payment/notify` (needs a public HTTPS URL)
   - **Polling:** the browser calls `GET /api/payment/status/:orderId`, which re-checks directly with NotchPay
5. On success: `PAID` + `PROCESSING`, stock decremented, coupon usage counted
6. Seller updates status manually as the order ships

**Security note:** the server never trusts an incoming webhook blindly — it always calls
NotchPay itself to verify before marking anything paid. A forged "payment successful" request
cannot create a paid order.

---

## 4. Money flow

- Customer payments land in **your** NotchPay balance (not the seller's).
- Each `OrderItem` stores a **frozen commission snapshot** (`commissionRate`, `platformFee`,
  `vendorEarning`) at order time — changing `COMMISSION_RATE_PERCENT` later never rewrites
  past earnings.
- Sellers see their **net** earnings (after commission) and their available balance.
- You pay sellers either:
  - **Automatically** — admin.html → Sellers → "Send via Mobile Money" (real NotchPay transfer), or
  - **Manually** — send money yourself, then "Record payout manually" to keep balances accurate.
- Delivery fees go entirely to the platform (never counted as seller earnings).

---

## 5. Environment variables

See `.env.example` for the full annotated list. Minimum to run:
`DATABASE_URL`, `APP_URL`, `ADMIN_SECRET`, `NOTCHPAY_PUBLIC_KEY`.

Add `NOTCHPAY_PRIVATE_KEY` for real payouts (also requires IP whitelisting at
`business.notchpay.co/settings/developer/ips`), `BREVO_API_KEY` + `EMAIL_FROM` for password
reset emails, and `CLOUDINARY_*` for seller photo uploads.

**`APP_URL` must include `https://` and no trailing slash** — a missing protocol is the classic
cause of a 404 after payment.

---

## 6. Database management

`schema.prisma` is the single source of truth. After any change to it:

```bash
npx prisma db push      # applies schema changes to Neon
npx prisma generate     # regenerates the JS client server.js imports
```

Then **restart the server** — the running process holds the old client in memory.

### Safety rules
- **Never** accept a "reset the schema" prompt or run `prisma migrate reset` unless you want
  to wipe all data. If `migrate dev` reports "Drift detected", answer **N** and use `db push`.
- `db push` warns before anything destructive — read the warning before typing `y`.
- Inspect data visually with `npx prisma studio`.

### Common errors

| Error | Cause | Fix |
|---|---|---|
| `Unknown argument 'x'` | Prisma client out of date vs schema | `npx prisma generate`, restart server |
| `Drift detected... reset?` | Migration history ≠ real DB | Answer **N**, use `npx prisma db push` |
| `P1001 Can't reach database` | Network blocking port 5432, or wrong URL | Try mobile hotspot; re-copy URL from Neon |
| `P1013 invalid database string` | Malformed `DATABASE_URL`, or `url = "DATABASE_URL"` instead of `url = env("DATABASE_URL")` in schema.prisma | Fix the schema line / re-copy the URL |
| `Internal Server Error` on checkout | Schema changed but not pushed | `npx prisma db push && npx prisma generate` |

---

## 7. Deployment (Vercel)

1. Push to your connected git branch → Vercel auto-deploys
2. Set **every** `.env` variable in Vercel → Settings → Environment Variables (the local `.env`
   is never uploaded)
3. Set `APP_URL` to your real Vercel domain in production

---

## 8. When something breaks — checklist

1. Prisma error? → section 6.
2. `401 Authentication required`? → token expired (7 days), log in again.
3. `403 Admin access required`? → `ADMIN_SECRET` missing or mismatched.
4. `Payment provider is not configured`? → `NOTCHPAY_PUBLIC_KEY` missing.
5. `NOTCHPAY_PRIVATE_KEY is not configured`? → needed only for real payouts.
6. 404 after paying? → `APP_URL` wrong (missing `https://` or set to localhost in production).
7. Seller can't see orders? → run `node admin-tools.mjs debug-orders` to inspect the
   seller↔listing↔order linkage.
8. Still stuck? → copy the **exact** error text (browser console F12, or the server terminal)
   rather than describing it.
