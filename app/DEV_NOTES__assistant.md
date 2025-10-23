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
