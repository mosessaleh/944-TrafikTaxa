import { prisma } from '@/lib/db';
import { CacheManager } from '@/lib/cache';
import Holidays from 'date-holidays';

function isHoliday(at: Date){
  // Check weekend (Saturday = 6, Sunday = 0)
  const dayOfWeek = at.getDay();
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return true;
  }

  // Check Danish public holidays
  const hd = new Holidays('DK');
  const holidays = hd.getHolidays(at.getFullYear());
  const ymd = at.toISOString().slice(0,10);
  if (holidays.some((h: any) => h.date.slice(0,10) === ymd)) {
    return true;
  }

  // Fallback to environment variable for custom holidays
  const list = (process.env.HOLIDAYS||'').split(',').map(s=> s.trim()).filter(Boolean);
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
  // Check cache first
  if (vehicleTypeId) {
    const cachedPrice = CacheManager.getPriceCache(distanceKm, durationMin, vehicleTypeId);
    if (cachedPrice !== null) {
      return cachedPrice;
    }
  }

  const base = await computeBase(distanceKm, durationMin, at);
  if (!vehicleTypeId) return base;

  const vt = await prisma.vehicleType.findUnique({ where: { id: vehicleTypeId }, select: { active: true, multiplier: true } });
  if (!vt || !vt.active) throw new Error('Vehicle type not available');

  const mul = Number(vt.multiplier || 1);
  let finalPrice = Math.round(base * (mul > 0 ? mul : 1));

  // Apply global discount
  const settings = await prisma.settings.findUnique({ where: { id: 1 } });
  let discountAmount = 0;
  if (settings && settings.discountPercentage > 0) {
    discountAmount = Math.min(
      finalPrice * (settings.discountPercentage / 100),
      settings.maxDiscountAmount || 0
    );
    finalPrice = Math.round(finalPrice - discountAmount);
  }

  // Cache the result
  CacheManager.setPriceCache(distanceKm, durationMin, vehicleTypeId, finalPrice);

  return finalPrice;
}

export async function computePriceWithDetails(distanceKm:number, durationMin:number, at: Date, vehicleTypeId?: number){
  const base = await computeBase(distanceKm, durationMin, at);
  if (!vehicleTypeId) return { originalPrice: base, finalPrice: base, discountAmount: 0 };

  const vt = await prisma.vehicleType.findUnique({ where: { id: vehicleTypeId }, select: { active: true, multiplier: true } });
  if (!vt || !vt.active) throw new Error('Vehicle type not available');

  const mul = Number(vt.multiplier || 1);
  const priceAfterMultiplier = Math.round(base * (mul > 0 ? mul : 1));

  // Apply global discount
  const settings = await prisma.settings.findUnique({ where: { id: 1 } });
  let discountAmount = 0;
  if (settings && settings.discountPercentage > 0) {
    discountAmount = Math.min(
      priceAfterMultiplier * (settings.discountPercentage / 100),
      settings.maxDiscountAmount || 0
    );
  }
  const finalPrice = Math.round(priceAfterMultiplier - discountAmount);

  return {
    originalPrice: priceAfterMultiplier,
    finalPrice,
    discountAmount
  };
}

export async function getSettingsForAdmin(){
  const settings = await prisma.settings.findUnique({ where: { id: 1 } });
  return settings;
}
