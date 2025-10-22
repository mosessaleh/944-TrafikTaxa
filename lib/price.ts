import { prisma } from '@/lib/db';

function isHoliday(at: Date){
  const list = (process.env.HOLIDAYS||'').split(',').map(s=> s.trim()).filter(Boolean);
  const ymd = at.toISOString().slice(0,10);
  return list.includes(ymd);
}

export async function computeBase(distanceKm:number, durationMin:number, at: Date){
  const hour = at.getHours();
  const isNight = (hour < 6 || hour >= 18) || isHoliday(at);
  const start = isNight ? 60 : 40;
  const perKm = isNight ? 16 : 12.75;
  const perMin = isNight ? 7 : 5.75;
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
