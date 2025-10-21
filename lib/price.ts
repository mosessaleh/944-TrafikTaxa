import { prisma } from '@/lib/db';

function parseHM(s: string){ const [h,m] = s.split(':').map(Number); return { h: h||0, m: m||0 }; }
function inNightWindow(date: Date, startHM: string, endHM: string){
  const h = date.getHours();
  const start = parseHM(startHM); // e.g., 06:00
  const end   = parseHM(endHM);   // e.g., 18:00
  const withinDay = (h > start.h && h < end.h) || (h === start.h && date.getMinutes() >= start.m) || (h === end.h && date.getMinutes() < end.m);
  return !withinDay;
}

function isHoliday(date: Date){
  const env = process.env.HOLIDAYS || '';
  if (!env) return false;
  const set = new Set(env.split(',').map(s=> s.trim()).filter(Boolean));
  const y = date.getFullYear(); const m = (date.getMonth()+1).toString().padStart(2,'0'); const d = date.getDate().toString().padStart(2,'0');
  const key = `${y}-${m}-${d}`;
  return set.has(key);
}

let _cache: any = null;
async function ensureSettings(){
  // حاول جلب الإعدادات من الكاش أولاً
  if (_cache) return _cache;
  let s = await prisma.settings.findFirst();
  if (!s) {
    // أنشئ سجل افتراضي عند أول استخدام
    s = await prisma.settings.create({ data: {
      dayBase:     40.00,
      dayPerKm:    12.75,
      dayPerMin:   5.75,
      nightBase:   60.00,
      nightPerKm:  16.00,
      nightPerMin: 7.00,
      workStart:   '06:00',
      workEnd:     '18:00'
    }});
    console.log('[settings] created default pricing');
  }
  _cache = s; return s;
}

export async function computePrice(distanceKm: number, durationMin: number, at: Date): Promise<number>{
  const s = await ensureSettings();
  const holiday = isHoliday(at);
  const night = holiday ? true : inNightWindow(at, s.workStart, s.workEnd);
  const base   = Number(night ? s.nightBase    : s.dayBase);
  const perKm  = Number(night ? s.nightPerKm   : s.dayPerKm);
  const perMin = Number(night ? s.nightPerMin  : s.dayPerMin);
  const price = base + distanceKm * perKm + durationMin * perMin;
  return Math.round(price * 100) / 100;
}

export async function getSettingsForAdmin(){
  const s = await ensureSettings();
  return s;
}
