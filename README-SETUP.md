# 🚀 دليل إعداد بيئة العمل على جهاز جديد

## الخطوة 1: استنساخ المستودع
```bash
git clone https://github.com/mosessaleh/944-TrafikTaxa.git
cd 944-TrafikTaxa
```

## الخطوة 2: تثبيت التبعيات
```bash
npm install
# أو
yarn install
```

## الخطوة 3: إعداد ملف البيئة

### إنشاء ملف .env:
```bash
cp .env.example .env
```

### تحديث قيم .env:
```bash
# ملف .env
AUTH_SECRET=your-super-secret-key-here-change-this
PUBLIC_BASE_URL=http://localhost:3000

# قاعدة البيانات
DATABASE_URL=mysql://username:password@localhost:3306/944_taxi

# إعدادات البريد الإلكتروني
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
FROM_EMAIL=your-email@gmail.com

# Resend (اختياري)
RESEND_API_KEY=your-resend-api-key
RESEND_FROM=944 Trafik <no-reply@944.dk>

# Stripe (اختياري للمدفوعات)
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...

# أيقونات Cryptocurrency (اختياري)
NOWNODES_API_KEY=your-nownodes-api-key
```

## الخطوة 4: إعداد قاعدة البيانات

### الخيار أ: MySQL محلي
1. تثبيت MySQL على جهازك
2. إنشاء قاعدة بيانات:
```sql
CREATE DATABASE 944_taxi;
```

### الخيار ب: استخدام Docker
```bash
# تشغيل MySQL في Docker
docker run --name 944-taxi-mysql -e MYSQL_ROOT_PASSWORD=root -e MYSQL_DATABASE=944_taxi -p 3306:3306 -d mysql:8.0

# أو استخدام docker-compose
docker-compose up -d mysql
```

### تحديث DATABASE_URL في .env:
```bash
# للمستخدم الافتراضي
DATABASE_URL=mysql://root:root@localhost:3306/944_taxi
```

## الخطوة 5: تشغيل المايجريشنز
```bash
# تطبيق schema Prisma
npx prisma migrate dev --name init

# توليد Prisma Client
npx prisma generate
```

## الخطوة 6: إنشاء بيانات الاختبار (اختيارية)
```bash
# تشغيل scripts لإنشاء بيانات اختبار
node scripts/create-test-user.js
node scripts/create-vehicle-type-4.js
node scripts/create-test-ride-13.js
node scripts/create-test-invoice.js
node scripts/update-test-invoice.js
```

## الخطوة 7: تشغيل التطبيق
```bash
# للتطوير
npm run dev

# للإنتاج
npm run build
npm start
```

## ✅ تحقق من نجاح الإعداد

### 1. التحقق من قاعدة البيانات:
```bash
# عرض جميع المايجريشنز
npx prisma migrate status

# فتح Prisma Studio (اختياري)
npx prisma studio
```

### 2. التحقق من التطبيق:
- افتح http://localhost:3000
- يجب أن يظهر الموقع بدون أخطاء
- صفحة تسجيل الدخول يجب أن تعمل

## 🐛 استكشاف الأخطاء الشائعة

### خطأ قاعدة البيانات:
```bash
# تأكد من تشغيل MySQL
systemctl start mysql  # Linux
brew services start mysql  # macOS

# تحقق من DATABASE_URL
echo $DATABASE_URL
```

### خطأ في التبعيات:
```bash
# حذف node_modules وإعادة التثبيت
rm -rf node_modules package-lock.json
npm install
```

### خطأ في Prisma:
```bash
# إعادة توليد المخطط
npx prisma generate
npx prisma db push
```

## 📋 الملفات المطلوبة (غير موجودة في Git)

1. **.env** - يجب إنشاؤه من .env.example
2. **node_modules/** - يتم تثبيته تلقائياً
3. **.next/** - يتم إنشاؤه تلقائياً
4. **قاعدة البيانات** - يجب إنشاؤها يدوياً

## 🔧 متطلبات النظام

- **Node.js** 18.0+ 
- **npm** أو **yarn**
- **MySQL** 8.0+ أو **Docker**
- **Git**

## 📞 للمساعدة

إذا واجهت أي مشاكل:
1. تحقق من رسائل الخطأ في console
2. تأكد من صحة DATABASE_URL
3. تأكد من تشغيل قاعدة البيانات
4. تحقق من ملف .env

---

**ملاحظة**: هذا المشروع يستخدم Next.js 13+ مع App Router و Prisma ORM