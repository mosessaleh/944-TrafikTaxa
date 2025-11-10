# Assistant Notes (Waves 0-4 baseline)
Date: 2025-10-23 07:16:08
- Non-breaking patch. No removal of existing pages/features.
- Added `/admin/pi` with live Pi price via `/api/crypto/pi`, refresh every 60s.
- Optional `.env`: COINGECKO_API_KEY.
- Scaffolds for i18n, notifications, and mock tracking (not wired to UI).
- ESLint/Prettier added.


[2025-10-23 07:32:49] Fixed admin top nav with explicit Links and added Pi tab safely.

[2025-10-23 07:39:44] Added /api/crypto/tickers for USDT/USDC/BTC and extended /admin/pi page to show them.

[2025-10-23 07:41:51] Updated /admin/pi to show USDT/USDC/BTC each with (USD, DKK, Last Updated) panels.

[2025-10-23 07:54:02] Multi-step payments scaffolded:
- Pages: /pay, /pay/card, /pay/crypto
- APIs: /api/payments/quote, /api/payments/wallets, /api/payments/crypto/confirm, /api/payments/card/mock-confirm
- Prisma models: CryptoWallet, CryptoPayment (run `npm run db:migrate`)
- Emails via SMTP (nodemailer). Fallback to console if not configured.

[2025-10-23 08:50:56] Added admin Crypto page with DB-backed symbols/price table and CRUD modals; updated nav; added admin APIs & lib/crypto.

[2025-10-23 09:02:23] Expanded SYMBOLS (ETH, BNB, XRP) with full network lists; updated validation & quote API; pay/crypto now uses SYMBOLS.
\n[2025-10-23 09:10:10] Added BookingRedirector (global) and tagged booking forms to auto-redirect to /bookings after success.\n\n[2025-10-23 09:13:53] BookingRedirector v2: detect booking forms & redirect to /pay with amount_dkk.\n\n[2025-10-23 09:18:20] BookingPayBridge: auto-redirect to /pay after booking (supports fetch/XHR).\n\n[2025-10-23 09:25:17] Server Action confirmBookingAndGoToPay wired into booking forms; client fallback added.\n
[2025-10-23 09:29:34] Fixed app/layout.tsx imports/body injection for BookingPayBridge + BookingClientFallback.
\n[2025-10-23 09:42:50] Booking modal flow: choose method, pay, then call original doBook; added CardPayment model & card API creates records.\n\n[2025-10-23 09:47:23] Added GlobalBookingModalManager: intercepts 'Confirm booking' clicks, opens modal, then re-triggers original click after payment.\n\n[2025-10-23 09:55:49] Booking modal now auto-detects amount from DOM (no manual input). Global manager captures and stores amount on click.\n\n[2025-10-23 10:00:47] Strengthened booking amount detection (supports 'kr.'), scans visible DOM with scoring to pick the Estimated Price.\n\n[2025-10-23 10:06:03] Crypto surcharge: +25 DKK added and displayed; per-coin amounts and API payloads now include fee.\n\n[2025-10-23 10:12:57] Amount detection fix: treat '.' as thousands and ',' as decimal by default to parse '1.050 kr.' as 1050.\n\n[2025-10-23 10:16:05] Amount detection: strip all '.' from numeric chunk; commas are decimals.\n\n[2025-10-23 10:18:59] Fix /api/payments/crypto/confirm: coerce userId to String(me.id); validate; create pending record; send notifications.\n\n[2025-10-23 10:21:24] API fix: removed txRef from cryptoPayment.create (schema doesn't have this column).\n
[2025-10-24 06:26:58] Added /api/crypto/available (public) to satisfy BookingPayModal; DB-first with graceful fallback.
