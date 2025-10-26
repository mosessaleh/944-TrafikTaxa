import { prisma } from '@/lib/db';

function isHoliday(at: Date){
  const list = (process.env.HOLIDAYS||'').split(',').map(s=> s.trim()).filter(Boolean);
  const ymd = at.toISOString().slice(0,10);
  return list.includes(ymd);
}

export async function computeBase(distanceKm:number, durationMin:number, at: Date){
  // اقرأ من Settings إن وُجد، وإلا استخدم القيم الافتراضية
  const settings = await prisma.settings.findUnique({ where: { id: 1 } }).catch(()=>null);
  const hour = at.getHours();
  const nightOrHoliday = (hour < 6 || hour >= 18) || isHoliday(at);

  const dayBase = settings?.dayBase ?? 40;
  const dayKm   = settings?.dayPerKm ?? 12.75;
  const dayMin  = settings?.dayPerMin ?? 5.75;
  const ngBase  = settings?.nightBase ?? 60;
  const ngKm    = settings?.nightPerKm ?? 16;
  const ngMin   = settings?.nightPerMin ?? 7;

  const start  = nightOrHoliday ? ngBase : dayBase;
  const perKm  = nightOrHoliday ? ngKm   : dayKm;
  const perMin = nightOrHoliday ? ngMin  : dayMin;

  const price = Math.max(0, start + perKm * distanceKm + perMin * durationMin);
  return Math.round(price);
}

export async function computePrice(distanceKm:number, durationMin:number, at: Date, vehicleTypeId?: number){
  const base = await computeBase(distanceKm, durationMin, at);
  if (!vehicleTypeId) return base;
  const vt = await prisma.vehicleType.findUnique({ where: { id: vehicleTypeId }, select: { active: true, multiplier: true } });
  if (!vt || !vt.active) throw new Error('Vehicle type not available');
  const mul = Number(vt.multiplier || 1);
  return Math.round(base * (mul > 0 ? mul : 1));
}

export async function getSettingsForAdmin(){
  const settings = await prisma.settings.findUnique({ where: { id: 1 } });
  return settings;
}
