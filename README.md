# Telecom Shop - Web app (Next.js 14 + Tailwind + shadcn-style components)

Built against `telecom-saas-backend` (Express + MongoDB). Shop owners, employees, Super Admin and admin staff all use this one app; the menu and pages change by role and permission.

## Run

```bash
npm install
cp .env.example .env.local     # API url + socket url
npm run dev                    # http://localhost:3000
```

Backend: set `FRONTEND_URL=http://localhost:3000` and `CORS_ORIGINS=http://localhost:3000`, run `npm run seed`, then log in as the Super Admin from your backend `.env`.
Production: host this app and the API on the same site (e.g. `app.example.com` + `api.example.com`) so the httpOnly refresh cookie works.

## What is where

| Area | Routes |
|---|---|
| Auth | `/login` `/register` |
| Shop owner | `/dashboard` `/sell` `/sales` `/products` `/categories` `/mfs` `/dues` `/capital` `/employees` `/billing` `/settings` `/chat` `/notifications` |
| Employee | same menu, only what the owner allowed (default: `/sell`, `/sales`, products without cost price) |
| Super Admin / staff | `/admin` `/admin/shops` `/admin/shops/[id]` (usage meter + block / restrict / plan / alert) `/admin/alerts` `/admin/chat` `/admin/plans` `/admin/payments` `/admin/staff` |

## Behaviour worth knowing

* **Money** is integer paisa everywhere. `taka()` / `toPaisa()` in `src/lib/utils.ts` convert.
* **POS** (`/sell`): USB scanner types into the search box and presses Enter; phone camera uses `BarcodeDetector` (Chrome / Android). Credit sale asks for customer + due date. Prints POS receipt or A4 from the server's invoice HTML.
* **Offline**: no internet -> the sale / MFS entry is saved in IndexedDB with a UUID and sent to `/sync/push` when back online (safe to resend). The product list is cached on the device for offline search. `public/sw.js` keeps the app shell openable offline (registered outside localhost).
* **Super Admin controls** reach the shop live over Socket.IO: block, restriction (full-page message, chat/billing still open), simple alert (pop-up once), hard alert (banner, writes paused), expired plan (banner, read-only).
* **Usage meter** (`/admin/shops/[id]`): dial = today's units against the shop's busiest day, odometer = total units, plus charts per day or month, active minutes (heartbeat every 60 s) and requests by module.
* **Capital popup** asks the owner once whether purchases are deducted from capital.
* **Barcodes**: labels are drawn with JsBarcode (Code128) and printed from a pop-up window.
* **Strong delete**: categories and products need the exact name typed.

## Language (বাংলা / English)

* Switch with the **বাংলা | EN** button (top bar on desktop, side menu on phones, Settings, login page). The choice is remembered on the device; first visit follows the browser language.
* English text is the key: `tr('Save')`. All Bangla lives in `src/lib/bn.ts`. A missing word simply shows in English, so you can add words any time. For a sentence with values use `tr('{n} items', { n: 3 })` and add `"{n} items": "{n}টি আইটেম"`.
* In Bangla mode money, numbers and dates show Bangla digits (১,২৫,০০০) and Bangla month names.
* Messages written by the super admin (alerts, chat) and names you type stay exactly as written.

## Not done yet

Real operator / MFS logos (coloured marks now; swap `ProviderMark`), automated tests. This code was written without installing packages, so run `npm install && npm run build` first and send me any type error you see.
