# 944 Trafik — Notes

## Auth & Roles
- جلسة المستخدم تُخزن في كوكي `session` (JWT). محليًا، ضع `COOKIE_SECURE=false` في `.env`.
- روابط Book / History / Profile لا تظهر إلا بعد تسجيل الدخول. رابط Admin يظهر فقط عند الدور `ADMIN`.

## ترقية مستخدم إلى ADMIN
- عبر API (يتطلب أن تكون مسجلاً كأدمن):
```
POST /api/admin/users/promote
{ "email": "user@example.com", "role": "ADMIN" }
```
- أو عبر Prisma Studio:
```
npx prisma studio
```
ثم عدّل حقل `role` للمستخدم إلى `ADMIN`.

## إعادة التوجيه بعد تسجيل الدخول
- بعد نجاح تسجيل الدخول، يتم تحويل المستخدم إلى الصفحة الرئيسية `/`.
