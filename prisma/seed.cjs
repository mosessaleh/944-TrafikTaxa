/* Seed Settings: inserts default pricing if not present */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main(){
  const exists = await prisma.settings.findFirst();
  if (!exists){
    await prisma.settings.create({ data: {
      // Morning (06:00–18:00)
      dayBase:     40.00,
      dayPerKm:    12.75,
      dayPerMin:   5.75,
      // Evening/Nights & Holidays (18:00–06:00, holidays all day)
      nightBase:   60.00,
      nightPerKm:  16.00,
      nightPerMin: 7.00,
      workStart:   '06:00',
      workEnd:     '18:00'
    }});
    console.log('[seed] Settings created');
  } else {
    console.log('[seed] Settings already exist, skipping');
  }
}

main().catch(e=>{ console.error(e); process.exit(1); }).finally(()=> prisma.$disconnect());
