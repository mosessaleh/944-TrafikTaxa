# قائمة التحقق قبل النشر - تفعيل الميزات

## مراقبة الأداء والتحليلات

### ✅ Google Analytics (معطل حاليًا بسبب CSP)
**الملفات المتعلقة**: `components/GoogleAnalytics.tsx`, `app/layout.tsx`

**ما يجب تفعيله قبل النشر**:
1. إضافة Google Analytics ID الحقيقي بدلاً من `GA_MEASUREMENT_ID`
2. إعادة تفعيل المكون في `app/layout.tsx`:
   ```tsx
   import GoogleAnalytics from '@/components/GoogleAnalytics';
   // ثم إضافته في JSX: <GoogleAnalytics />
   ```
3. التأكد من أن CSP يسمح بالسكريبتات من `https://www.googletagmanager.com`
4. اختبار إرسال Web Vitals إلى GA

**التأثير**: تتبع Core Web Vitals (CLS, FCP, LCP, TTFB, INP) وأحداث المستخدم

### ✅ متغيرات البيئة المطلوبة
**الملفات المتعلقة**: `.env`, `lib/auth.ts`, `components/ErrorMonitoring.tsx`, `lib/stripe.ts`

**ما يجب التحقق منه**:
1. `SECRET` - مطلوب لتشفير JWT
2. `NEXT_PUBLIC_SENTRY_DSN` - لمراقبة الأخطاء
3. `DATABASE_URL` - للاتصال بقاعدة البيانات
4. `ASSET_PREFIX` - لـ CDN إذا كان مستخدمًا
5. `STRIPE_SECRET_KEY` - مفتاح Stripe الحقيقي (ليس الاختبار)
6. `STRIPE_PUBLISHABLE_KEY` - مفتاح Stripe العام الحقيقي
7. `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` - مفتاح Stripe العام للعميل

### ✅ إعدادات الدفع
**الملفات المتعلقة**: `lib/stripe.ts`, `.env`

**ما يجب تغييره قبل النشر**:
1. استبدال `STRIPE_SECRET_KEY` من مفتاح الاختبار إلى مفتاح الإنتاج
2. استبدال `STRIPE_PUBLISHABLE_KEY` من مفتاح الاختبار إلى مفتاح الإنتاج
3. استبدال `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` من مفتاح الاختبار إلى مفتاح الإنتاج
4. اختبار عمليات الدفع في الإنتاج
5. التأكد من أن webhooks محدثة للإنتاج

**تحذير**: استخدام مفاتيح الاختبار في الإنتاج سيمنع معالجة المدفوعات الحقيقية

### ✅ إعدادات قاعدة البيانات
**الملفات المتعلقة**: `prisma/schema.prisma`, `prisma/migrations/`

**ما يجب تطبيقه قبل النشر**:
1. تشغيل `prisma migrate deploy` في الإنتاج
2. التأكد من تطبيق جميع indexes الجديدة
3. اختبار استعلامات قاعدة البيانات

### ✅ إعدادات الأمان
**الملفات المتعلقة**: `next.config.mjs`, `middleware.ts`

**ما يجب التحقق منه**:
1. Content Security Policy محدثة
2. Rate limiting مفعلة
3. Security headers مُعينة
4. HTTPS مُفعل

### ✅ تحسينات الأداء
**الملفات المتعلقة**: `next.config.mjs`, `components/OptimizedComponents.tsx`

**ما تم تطبيقه بالفعل**:
- ✅ Code splitting للحزم
- ✅ Image optimization
- ✅ Caching headers
- ✅ Bundle analysis جاهز

### ✅ اختبارات
**الأوامر المطلوبة**:
```bash
yarn test          # اختبارات الوحدات
yarn test:e2e      # اختبارات E2E
yarn build         # التأكد من البناء الناجح
yarn analyze       # تحليل الحزم (يتطلب env setup)
```

## خطوات النشر

### قبل النشر
- [ ] تحديث Google Analytics ID
- [ ] إعادة تفعيل Google Analytics
- [ ] تغيير مفاتيح Stripe من الاختبار إلى الإنتاج
- [ ] التحقق من جميع متغيرات البيئة
- [ ] تشغيل migrations
- [ ] اختبار البناء
- [ ] تشغيل جميع الاختبارات
- [ ] اختبار عمليات الدفع

### أثناء النشر
- [ ] مراقبة logs للأخطاء
- [ ] التحقق من Web Vitals في GA
- [ ] مراقبة أداء قاعدة البيانات

### بعد النشر
- [ ] اختبار جميع الميزات
- [ ] مراقبة Error Monitoring في Sentry
- [ ] قياس الأداء بـ Lighthouse
- [ ] التحقق من تحميل الصفحات

---

**تاريخ الإنشاء**: ديسمبر 2025
**الغرض**: تذكير بتفعيل الميزات المعطلة قبل النشر النهائي