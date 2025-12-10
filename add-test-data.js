const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function addTestData() {
  try {
    console.log('🚀 بدء إضافة البيانات التجريبية...');

    // إنشاء شركات متعددة
    const companies = [];
    for (let i = 1; i <= 5; i++) {
      try {
        const company = await prisma.partnerCompany.upsert({
          where: { cvr: `1234567${i}` },
          update: {},
          create: {
            cvr: `1234567${i}`,
            comName: `شركة تاكسي تجريبية ${i}`,
            contactPerson: `مدير الشركة ${i}`,
            comAddress: `عنوان تجريبي ${i}`,
            comPhone: `1234567${i}`,
            comEmail: `company${i}@taxi.dk`,
            commissionRate: 10.0 + (i * 2),
            contractSigned: true,
            comUserName: `company${i}_test_${Date.now()}`, // جعل اسم المستخدم فريداً
            comPass: await bcrypt.hash('password123', 10)
          }
        });
        companies.push(company);
        console.log(`✅ تم إنشاء الشركة ${i}: ${company.comName}`);
      } catch (error) {
        console.log(`⚠️ الشركة ${i} موجودة مسبقاً، جاري استخدام البيانات الموجودة`);
        // البحث عن الشركة الموجودة
        const existingCompany = await prisma.partnerCompany.findFirst({
          where: { cvr: `1234567${i}` }
        });
        if (existingCompany) {
          companies.push(existingCompany);
        }
      }
    }

    // إنشاء أكثر من 50 سائق
    const drivers = [];
    const vehicleTypes = ['SEDAN5', 'SEVEN_NO_BAG', 'VAN'];
    const makes = ['Toyota', 'Honda', 'Ford', 'BMW', 'Mercedes', 'Audi', 'Volkswagen', 'Skoda'];
    const models = ['Corolla', 'Civic', 'Focus', 'X3', 'C-Class', 'A4', 'Golf', 'Octavia'];

    for (let i = 1; i <= 60; i++) {
      const companyIndex = (i - 1) % companies.length;
      const company = companies[companyIndex];

      const uniqueTimestamp = Date.now();
      const uniqueRegNumber = `CAR${i.toString().padStart(3, '0')}_test_${uniqueTimestamp}`;

      // إنشاء سائق جديد دائماً (بدون فحص التكرار لتجنب المشاكل)
      const driver = await prisma.comdriver.create({
        data: {
          comId: company.id,
          cpr: `123456789${i.toString().padStart(1, '0')}_${uniqueTimestamp}`,
          drFname: `سائق${i}`,
          drLname: `تجريبي${i}`,
          sex: i % 2 === 0 ? 'MALE' : 'FEMALE',
          drAddress: `عنوان السائق ${i}`,
          drPhone: `9876543${i.toString().padStart(1, '0')}`,
          drEmail: `driver${i}@taxi.dk`,
          licenceNr: `LIC${i.toString().padStart(3, '0')}`,
          rating: 3.5 + (Math.random() * 1.5), // تقييم بين 3.5 و 5.0
          isOnline: Math.random() > 0.3, // 70% من السائقين متصلين
          isActive: true,
          car: uniqueRegNumber, // استخدام نفس رقم السيارة
          drUsername: `driver${i}_test_${uniqueTimestamp}`,
          drPass: await bcrypt.hash('password123', 10)
        }
      });
      drivers.push(driver);

      try {
        // إنشاء سيارة للسائق
        const vehicleType = vehicleTypes[Math.floor(Math.random() * vehicleTypes.length)];
        const make = makes[Math.floor(Math.random() * makes.length)];
        const model = models[Math.floor(Math.random() * models.length)];

        // توزيع السيارات في منطقة كوبنهاغن
        const baseLat = 55.6761;
        const baseLon = 12.5683;
        const latOffset = (Math.random() - 0.5) * 0.1; // ±0.05 درجة
        const lonOffset = (Math.random() - 0.5) * 0.1;

        await prisma.comvehicles.upsert({
          where: { regNumber: uniqueRegNumber },
          update: {},
          create: {
            comId: company.id,
            regNumber: uniqueRegNumber,
            make: make,
            model: model,
            vehicleType: vehicleType,
            lastLat: baseLat + latOffset,
            lastLon: baseLon + lonOffset,
            lastLocationUpdate: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000), // آخر 24 ساعة
            status: 1
          }
        });
      } catch (error) {
        console.log(`⚠️ فشل في إنشاء سيارة للسائق ${i}`);
      }

      if (i % 10 === 0) {
        console.log(`✅ تم إنشاء ${i} سائق وسيارة`);
      }
    }

    // إضافة بعض الرحلات المكتملة للسائقين لتحسين التقييمات
    console.log('📊 إضافة رحلات تجريبية...');
    for (let i = 0; i < 200; i++) {
      const randomDriver = drivers[Math.floor(Math.random() * drivers.length)];
      const isCompleted = Math.random() > 0.1; // 90% من الرحلات مكتملة

      await prisma.ride.create({
        data: {
          userId: 1, // افتراضي - يمكنك تغييره حسب الحاجة
          driverId: randomDriver.id,
          riderName: `عميل تجريبي ${i}`,
          passengers: 1,
          pickupAddress: 'عنوان تجريبي',
          dropoffAddress: 'عنوان تجريبي آخر',
          startLatLon: { lat: 55.6761, lon: 12.5683 },
          endLatLon: { lat: 55.6861, lon: 12.5783 },
          scheduled: false,
          pickupTime: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000), // آخر 30 يوم
          distanceKm: 5 + Math.random() * 15, // 5-20 كم
          durationMin: 10 + Math.random() * 30, // 10-40 دقيقة
          price: 50 + Math.random() * 200, // 50-250 كرون
          status: isCompleted ? 'COMPLETED' : 'CANCELED',
          paymentStatus: isCompleted ? 'PAID' : 'PENDING_PAYMENT',
          paymentMethod: 'card',
          vehicleTypeId: 1
        }
      });
    }

    console.log('🎉 تم إنشاء البيانات التجريبية بنجاح!');
    console.log(`📊 الإحصائيات:`);
    console.log(`   • ${companies.length} شركة`);
    console.log(`   • ${drivers.length} سائق`);
    console.log(`   • ${drivers.length} سيارة`);
    console.log(`   • 200 رحلة تجريبية`);

    // إحصائيات إضافية
    const onlineDrivers = drivers.filter(d => d.isOnline).length;
    console.log(`   • ${onlineDrivers} سائق متصل الآن`);

  } catch (error) {
    console.error('❌ خطأ في إضافة البيانات:', error);
  } finally {
    await prisma.$disconnect();
  }
}

addTestData();