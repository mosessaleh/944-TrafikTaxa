import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { processMessage } from '@/lib/whatsapp-ai';
import { createWhatsAppPaymentSession } from '@/lib/stripe';
import type { AIResponse } from '@/lib/whatsapp-ai';

const WHATSAPP_API_VERSION = 'v22.0';

// ========================
// Language detection
// ========================

function detectLanguage(text: string, sessionLang?: string): 'ar' | 'dk' | 'en' {
  // If session already has a language from AI, use it
  if (sessionLang && ['ar', 'dk', 'en'].includes(sessionLang)) return sessionLang as 'ar' | 'dk' | 'en';

  const arabic = /[\u0600-\u06FF]/.test(text);
  if (arabic) return 'ar';
  const dkLetters = /[æøåÆØÅ]/.test(text);
  if (dkLetters) return 'dk';

  // Danish keywords detection (most common Danish words without special chars)
  const dkWords = /\b(jeg|du|er|det|ikke|en|og|at|på|til|med|der|for|som|har|kan|vil|skal|være|men|hvad|hvor|hvem|hvordan|hvornår|hvorfor|her|der|nu|også|igen|hej|tak|gerne|bestille|brug|hjælp|bil|taxa|tur|kør|afhent|hent|adresse|køre|fra|herfra)\b/i;
  const dkCount = (text.match(dkWords) || []).length;
  const enWords = /\b(the|you|are|not|and|to|with|for|can|will|help|car|taxi|ride|pick|drop|address|from|here|where|when|what|how|please|thanks|book|drive|need|want|get)\b/i;
  const enCount = (text.match(enWords) || []).length;

  if (dkCount > enCount && dkCount >= 2) return 'dk';
  return 'en';
}

// ========================
// Validation (مطابق للخادم)
// ========================

const NAME_REGEX = /^[^\u0600-\u06FF\s\-'\.]+$/u;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateName(value: string): string | null {
  if (!value || value.trim().length < 1) return null;
  if (!NAME_REGEX.test(value.trim())) return 'invalid_chars';
  return null;
}

// ========================
// Multi-language verification messages
// ========================

const MSG = {
  verifyPrompt: {
    ar: (name: string, email: string) => `مرحباً ${name}! ❗ بريدك الإلكتروني غير مفعل بعد.\n\nالرجاء إدخال رمز التحقق المكون من 6 أرقام الذي تم إرساله إلى ${email}.\n\nأرسل "resend" لإعادة إرسال الرمز.`,
    dk: (name: string, email: string) => `Hej ${name}! ❗ Din email er ikke bekræftet endnu.\n\nIndtast den 6-cifrede bekræftelseskode, der blev sendt til ${email}.\n\nSend "resend" for at få en ny kode.`,
    en: (name: string, email: string) => `Hello ${name}! ❗ Your email is not verified yet.\n\nPlease enter the 6-digit verification code sent to ${email}.\n\nSend "resend" to get a new code.`,
  },
  codeExpired: {
    ar: 'انتهت صلاحية رمز التحقق. أرسل "resend" لإعادة إرسال رمز جديد.',
    dk: 'Bekræftelseskoden er udløbet. Send "resend" for at få en ny kode.',
    en: 'Verification code expired. Send "resend" to get a new code.',
  },
  wrongCode: {
    ar: '❌ الرمز غير صحيح. حاول مرة أخرى، أو أرسل "resend" لإعادة إرسال الرمز، أو أرسل /reset.',
    dk: '❌ Forkert kode. Prøv igen, send "resend" for en ny kode, eller send /reset.',
    en: '❌ Wrong code. Try again, send "resend" for a new code, or send /reset.',
  },
  codeResent: {
    ar: (email: string) => `✅ تم إرسال رمز تحقق جديد إلى ${email}. الرجاء إدخال الرمز المكون من 6 أرقام.`,
    dk: (email: string) => `✅ En ny bekræftelseskode er sendt til ${email}. Indtast den 6-cifrede kode.`,
    en: (email: string) => `✅ A new verification code was sent to ${email}. Please enter the 6-digit code.`,
  },
  askCode: {
    ar: 'الرجاء إدخال رمز التحقق المكون من 6 أرقام الذي تم إرساله إلى بريدك الإلكتروني.\n\nأرسل "resend" لإعادة إرسال الرمز.',
    dk: 'Indtast den 6-cifrede bekræftelseskode, der blev sendt til din email.\n\nSend "resend" for at få en ny kode.',
    en: 'Please enter the 6-digit verification code sent to your email.\n\nSend "resend" to get a new code.',
  },
  emailVerified: {
    ar: (name: string) => `✅ تم تأكيد البريد الإلكتروني! مرحباً ${name}.\n\nيمكنك الآن حجز تكسي. أخبرني من أين وإلى أين تريد.`,
    dk: (name: string) => `✅ Email bekræftet! Velkommen ${name}.\n\nDu kan nu bestille en taxa. Fortæl mig hvorfra og hvortil du skal.`,
    en: (name: string) => `✅ Email verified! Welcome ${name}.\n\nYou can now book a taxi. Tell me where you want to go.`,
  },
  regSuccess: {
    ar: (email: string) => `✅ تم التسجيل! تم إرسال رمز تحقق إلى ${email}.\n\nالرجاء إدخال الرمز المكون من 6 أرقام لتأكيد بريدك الإلكتروني.`,
    dk: (email: string) => `✅ Registreret! Vi har sendt en bekræftelseskode til ${email}.\n\nIndtast den 6-cifrede kode for at bekræfte din email.`,
    en: (email: string) => `✅ Registered! We sent a verification code to ${email}.\n\nEnter the 6-digit code to verify your email.`,
  },
  bookingCreating: {
    ar: '⏳ جاري إنشاء الحجز...',
    dk: '⏳ Opretter booking...',
    en: '⏳ Creating booking...',
  },
  bookingCreatingMeter: {
    ar: '⏳ جاري إنشاء الحجز (عداد)...',
    dk: '⏳ Opretter booking (taxameter)...',
    en: '⏳ Creating booking (meter)...',
  },
  bookingCash: (bookingId: number, vtName: string, from: string, to: string, time: string, price: number, lang: 'ar'|'dk'|'en', stop?: string) => {
    const cancelNote = lang === 'ar'
      ? '\n\n⏱️ يمكنك إلغاء الحجز خلال 3 دقائق بإرسال "cancel".'
      : lang === 'dk'
        ? '\n\n⏱️ Du kan annullere bookingen inden for 3 minutter ved at sende "cancel".'
        : '\n\n⏱️ You can cancel this booking within 3 minutes by sending "cancel".';

    const stopLine = stop ? (lang === 'ar' ? `\n🛑 محطة: ${stop}` : lang === 'dk' ? `\n🛑 Stop: ${stop}` : `\n🛑 Stop: ${stop}`) : '';

    if (lang === 'ar') {
      return `✅ تم الحجز!\n\n📋 #${bookingId}\n🚕 ${vtName}\n📍 من: ${from}${stopLine}\n📍 إلى: ${to}\n🕐 ${time}\n💰 السعر التقريبي: ${price} DKK\n💵 الدفع: عداد (كاش)\n\nتم إعلام السائق. شكراً لاختيارك 944 Trafik!${cancelNote}`;
    }
    if (lang === 'dk') {
      return `✅ Bestilt!\n\n📋 #${bookingId}\n🚕 ${vtName}\n📍 Fra: ${from}${stopLine}\n📍 Til: ${to}\n🕐 ${time}\n💰 Ca. pris: ${price} DKK\n💵 BETALING: Taxameter (kontant)\n\nChaufføren er informeret. Tak fordi du valgte 944 Trafik!${cancelNote}`;
    }
    return `✅ Booked!\n\n📋 #${bookingId}\n🚕 ${vtName}\n📍 From: ${from}${stopLine}\n📍 To: ${to}\n🕐 ${time}\n💰 Estimated price: ${price} DKK\n💵 Payment: Meter (cash)\n\nThe driver has been notified. Thank you for choosing 944 Trafik!${cancelNote}`;
  },
  bookingCard: (bookingId: number, vtName: string, from: string, to: string, price: number, paymentUrl: string, lang: 'ar'|'dk'|'en', stop?: string) => {
    const cancelNote = lang === 'ar'
      ? '\n\n⏱️ يمكنك إلغاء الحجز خلال 3 دقائق بإرسال "cancel".'
      : lang === 'dk'
        ? '\n\n⏱️ Du kan annullere bookingen inden for 3 minutter ved at sende "cancel".'
        : '\n\n⏱️ You can cancel this booking within 3 minutes by sending "cancel".';

    const stopLine = stop ? (lang === 'ar' ? `\n🛑 ${stop}` : lang === 'dk' ? `\n🛑 ${stop}` : `\n🛑 ${stop}`) : '';

    if (lang === 'ar') {
      return `📋 الحجز #${bookingId}\n🚕 ${vtName}\n📍 ${from} → ${to}${stopLine}\n💰 ${price} DKK\n\nللدفع بالبطاقة:\n${paymentUrl}\n\nسيتم تأكيد الحجز بعد إتمام الدفع.${cancelNote}`;
    }
    if (lang === 'dk') {
      return `📋 Booking #${bookingId}\n🚕 ${vtName}\n📍 ${from} → ${to}${stopLine}\n💰 Pris: ${price} DKK\n\nBetal med kort her:\n${paymentUrl}\n\nDin booking bekræftes når betalingen gennemført.${cancelNote}`;
    }
    return `📋 Booking #${bookingId}\n🚕 ${vtName}\n📍 ${from} → ${to}${stopLine}\n💰 Price: ${price} DKK\n\nPay by card:\n${paymentUrl}\n\nYour booking will be confirmed after payment.${cancelNote}`;
  },
  cancelSuccess: {
    ar: '✅ تم إلغاء الحجز بنجاح.',
    dk: '✅ Bookingen er annulleret.',
    en: '✅ Booking cancelled successfully.',
  },
  cancelExpired: {
    ar: '❌ انتهت مهلة الإلغاء (3 دقائق). لا يمكن إلغاء الحجز الآن.',
    dk: '❌ Annulleringsfristen (3 minutter) er udløbet. Bookingen kan ikke annulleres nu.',
    en: '❌ Cancellation window (3 minutes) has expired. The booking cannot be cancelled now.',
  },
  cancelFailed: {
    ar: '❌ فشل إلغاء الحجز. يرجى التواصل مع الدعم.',
    dk: '❌ Kunne ikke annullere bookingen. Kontakt venligst support.',
    en: '❌ Failed to cancel booking. Please contact support.',
  },
  noBookingToCancel: {
    ar: 'لا يوجد حجز نشط للإلغاء.',
    dk: 'Ingen aktiv booking at annullere.',
    en: 'No active booking to cancel.',
  },
};

// ========================
// Reset instructions message
// ========================

const RESET_MSG: Record<string, string> = {
  ar: `🔄 تم إعادة الضبط!

📋 طريقة حجز التكسي:
سأطرح عليك الأسئلة خطوة بخطوة. يمكنك أيضاً كتابة كل شيء في رسالة واحدة.

الخطوات:
1️⃣ من أين ننطلق؟
2️⃣ إلى أين نذهب؟
3️⃣ محطة في الطريق؟ (اختياري - اكتب "لا" للتخطي)
4️⃣ متى تريد الرحلة؟
5️⃣ نوع السيارة: عادية(4)/كبيرة(6-7)/فان(8)/لكزس
6️⃣ طريقة الدفع: كاش أو بطاقة

مثال للرسالة الواحدة:
"المحطة المركزية إلى المطار، فان، الآن، كاش"

أوامر سريعة:
/reset • cancel • rebook 123

جاهز؟ من أين ننطلق؟`,
  dk: `🔄 Nulstillet!

📋 Booking trin (eller skriv alt på én gang):
1️⃣ Hvor skal du afhentes?
2️⃣ Hvor skal du hen?
3️⃣ Stop undervejs? (valgfrit)
4️⃣ Hvornår?
5️⃣ Bil: Standard(4)/Stor(6-7)/Van(8)/Luksus
6️⃣ Betaling: Kontant/Kort

Eksempel: "Fra Hovedbanegården til lufthavnen, varevogn, nu, kontant"

Kommandoer: /reset • cancel • rebook 123

Klar? Hvor skal du afhentes?`,
  en: `🔄 Reset!

📋 Booking steps (or send everything in one message):
1️⃣ Pickup location?
2️⃣ Dropoff location?
3️⃣ Any stop along the way? (optional - type "no")
4️⃣ When do you need the ride?
5️⃣ Vehicle: Standard(4)/Large(6-7)/Van(8)/Luxury
6️⃣ Payment: Cash or Card

Example: "Central Station to Airport, van, now, cash"

Commands: /reset • cancel • rebook 123 • edit 123 • edit 123

Ready? Where should we pick you up?`,
};

const HELP_MSG: Record<string, string> = {
  ar: `ℹ️ *قائمة الأوامر المتاحة:*

🚕 *حجز رحلة:*
• اكتب تفاصيل الرحلة مباشرة
  مثال: "من المحطة إلى المطار، فان، الآن، كاش"
• أو أجب على الأسئلة خطوة بخطوة

🔄 *أوامر سريعة:*
• /reset — البدء من جديد
• cancel — إلغاء حجز خلال 3 دقائق
• rebook 123 — إعادة حجز رحلة سابقة
• edit 123 — تعديل عنوان رحلة مجدولة
• endchat — إنهاء الدردشة مع السائق

💬 *الدردشة مع السائق:*
• بعد تعيين سائق، أي رسالة ترسلها تصل للسائق مباشرة
• اكتب "endchat" لإنهاء الدردشة`,
  dk: `ℹ️ *Tilgængelige kommandoer:*

🚕 *Bestil en tur:*
• Skriv dine rejsedetaljer direkte
  Eksempel: "Fra Hovedbanegården til lufthavnen, varevogn, nu, kontant"
• Eller svar på spørgsmålene trin for trin

🔄 *Hurtige kommandoer:*
• /reset — start forfra
• cancel — annuller booking (inden 3 min)
• rebook 123 — genbestil en tidligere tur
• edit 123 — rediger adresse på planlagt tur
• endchat — afslut chat med chauffør

💬 *Chat med chauffør:*
• Når en chauffør er tildelt, sendes dine beskeder direkte
• Skriv "endchat" for at afslutte chatten`,
  en: `ℹ️ *Available Commands:*

🚕 *Book a ride:*
• Write your trip details directly
  Example: "From Central Station to Airport, van, now, cash"
• Or answer the questions step by step

🔄 *Quick Commands:*
• /reset — start over
• cancel — cancel booking within 3 min
• rebook 123 — rebook a past ride
• edit 123 — edit address of scheduled ride
• endchat — end chat with driver

💬 *Chat with driver:*
• After a driver is assigned, your messages go directly to them
• Type "endchat" to stop chatting`,
};

// ========================
// Background processing
// ========================
// Session State
// ========================

type ConvStage = 'greeting' | 'registration' | 'verify_email' | 'booking' | 'payment' | 'menu';

interface BotSession {
  phone: string;
  stage: ConvStage;
  userId: number | null;
  userExists: boolean;
  firstName: string;
  collected: Record<string, string>;
  chatHistory: { role: 'user' | 'assistant'; content: string }[];
  ts: number;
}

const sessions = new Map<string, BotSession>();
const TTL = 30 * 60 * 1000;

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of sessions) if (now - v.ts > TTL) sessions.delete(k);
}, 5 * 60 * 1000);
setInterval(() => {}, 5 * 60 * 1000); // keep alive

function touch(s: BotSession) { s.ts = Date.now(); sessions.set(s.phone, s); }

// ========================
// Users & Registration (مطابق للخادم)
// ========================

async function findUserByPhone(phone: string) {
  try { return await prisma.user.findFirst({ where: { phone: phone.trim() } }); }
  catch { return null; }
}

async function doRegister(
  email: string, fname: string, lname: string, phone: string, addr: string, userPassword: string
): Promise<{ ok: boolean; uid?: number; error?: string }> {
  try {
    const exists = await prisma.user.findUnique({ where: { email: email.trim() } });
    if (exists) return { ok: false, error: 'هذا البريد مسجل مسبقاً' };

    const hashed = await hashPassword(userPassword);
    const code = String(Math.floor(100000 + Math.random() * 900000));

    const user = await prisma.user.create({
      data: {
        email: email.trim(), firstName: fname.trim(), lastName: lname.trim(),
        phone: phone.trim(), address: addr.trim(), hashedPassword: hashed,
        emailVerifyCode: code, emailVerifyExpires: new Date(Date.now() + 36e5),
      },
    });

    import('@/lib/email').then(({ sendEmail }) =>
      sendEmail(email.trim(), 'Verify your email - 944 Trafik',
        `<p>Welcome! Your verification code: <b>${code}</b>. It expires in 1 hour.</p>`).catch(() => {})
    );

    return { ok: true, uid: user.id };
  } catch (e: any) { console.error('[WA Register]', e); return { ok: false, error: 'فشل التسجيل' }; }
}

// ========================
// Smart Address Resolution
// ========================

interface ResolvedAddress {
  address: string;
  lat: number;
  lon: number;
  source: 'user_profile' | 'favorite' | 'airport' | 'geocoded' | 'fallback';
}

async function geocodeGoogle(address: string): Promise<{ address: string; lat: number; lon: number } | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return null;

  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&region=dk&key=${apiKey}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const data = await res.json();

    if (data.status === 'ZERO_RESULTS') {
      console.log(`[geocodeGoogle] ZERO_RESULTS for "${address}" — rejecting`);
      return null;
    }

    if (data.status !== 'OK' || !data.results?.[0]?.geometry?.location) return null;

    const result = data.results[0];

    // REJECT if partial_match — Google didn't find exact match, used partial
    if (result.partial_match === true) {
      console.log(`[geocodeGoogle] Rejected partial_match: "${address}" → "${result.formatted_address}"`);
      return null;
    }

    // REJECT broad location types when user typed a street address
    const types: string[] = result.types || [];
    const isBroadType = types.every((t: string) =>
      ['locality','administrative_area_level_1','administrative_area_level_2','administrative_area_level_3',
       'country','political','colloquial_area','postal_code'].includes(t));
    const isPrecise = types.includes('street_address') || types.includes('premise') || types.includes('route');
    const queryLower = address.toLowerCase();
    const hasStreetIndicators = /\b(vej|gade|stræde|alle|boulevard|plads|torv|road|street|avenue|lane|drive|court|way|close|park|plaats|شا|شارع|طريق|ساحة|weg|steeg|gracht|kade|singel|laan|hof|pad|dreef)\b/i.test(queryLower);
    const hasNumber = /\b\d{1,4}\b/.test(queryLower);

    if (isBroadType && !isPrecise && (hasStreetIndicators || hasNumber)) {
      console.log(`[geocodeGoogle] Rejected broad match: "${address}" → "${result.formatted_address}" (types: ${types.join(',')})`);
      return null;
    }

    // REJECT if location_type is not precise enough for street addresses
    const locType = result.geometry?.location_type;
    if ((hasStreetIndicators || hasNumber) && locType && locType !== 'ROOFTOP' && locType !== 'RANGE_INTERPOLATED') {
      console.log(`[geocodeGoogle] Rejected imprecise location_type: "${address}" (${locType})`);
      return null;
    }

    return {
      address: result.formatted_address || address,
      lat: result.geometry.location.lat,
      lon: result.geometry.location.lng,
    };
  } catch { return null; }
}

async function geocodeNominatim(address: string): Promise<{ address: string; lat: number; lon: number } | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`;
    const res = await fetch(url, {
      headers: { 'Accept': 'application/json', 'User-Agent': '944-trafik-whatsapp' },
      signal: AbortSignal.timeout(5000),
    });
    const data = await res.json();
    if (data?.[0]) {
      const result = data[0];
      const osmType = result.type || '';
      const displayName = (result.display_name || '').toLowerCase();
      const queryLower = address.toLowerCase();

      // Validate match quality
      const broadTypes = ['administrative', 'city', 'town', 'municipality', 'county', 'postcode', 'boundary', 'postal_code'];
      const isBroadResult = broadTypes.includes(osmType);
      const hasStreetTerms = /\b(vej|gade|stræde|alle|boulevard|plads|torv|road|street|avenue|lane|drive|court|way|close|park|plaats|شا|شارع|طريق|ساحة|weg|steeg|gracht|kade|singel|laan|hof|pad|dreef|plantsoen)\b/i.test(queryLower);
      const hasNumber = /\b\d{1,4}\b/.test(queryLower);
      const resultHasNumber = /\b\d{1,4}\b/.test(displayName);

      if (isBroadResult && hasStreetTerms) {
        console.log(`[geocodeNominatim] Rejected broad match: "${address}" → "${displayName}" (${osmType})`);
        return null;
      }
      if (hasNumber && !resultHasNumber && hasStreetTerms) {
        console.log(`[geocodeNominatim] Rejected missing street number: "${address}" → "${displayName}"`);
        return null;
      }

      return { address: data[0].display_name || address, lat: Number(data[0].lat), lon: Number(data[0].lon) };
    }
    return null;
  } catch { return null; }
}

// ========================
// ========================
// Confirm booking handler (extracted for reuse)
// ========================

async function handleMeterConfirmation(phone: string, rideId: number, isYes: boolean) {
  const user = await findUserByPhone(phone);
  if (!user) return;

  const ride = await (prisma as any).ride.findUnique({
    where: { id: rideId },
    select: { id: true, userId: true, driverNote: true, price: true, status: true },
  });
  if (!ride || ride.userId !== user.id) return;

  const note = ride.driverNote || '';
  const driverPriceMatch = note.match(/DRIVER:(\d+)/);
  const driverPrice = driverPriceMatch ? parseInt(driverPriceMatch[1]) : 0;

  if (!driverPrice || !note.includes('PENDING_CONFIRMATION')) {
    await sendWA(phone, 'No pending meter price to confirm.');
    return;
  }

  if (isYes) {
    // Rider confirms the price
    const updatedNote = note
      .replace('PENDING_CONFIRMATION', 'CONFIRMED')
      .replace(/DRIVER:\d+/, `FINAL:${driverPrice}`);
    await (prisma as any).ride.update({
      where: { id: rideId },
      data: {
        driverNote: updatedNote,
        price: driverPrice,
      },
    });
    await sendWA(phone, `✅ Price confirmed: ${driverPrice} DKK. Thank you for your honesty!`);
  } else {
    // Rider disputes the price — ask for the real price
    const s = sessions.get(phone) || { phone, stage: 'booking', userId: user.id, userExists: true, firstName: user.firstName || '', collected: {}, chatHistory: [], ts: Date.now() };
    s.collected['_meterDisputeRideId'] = String(rideId);
    s.collected['_meterDisputeDriverPrice'] = String(driverPrice);
    touch(s);
    await sendWA(phone, `❓ The driver reported ${driverPrice} DKK. What was the actual meter price? Please enter the correct amount in DKK.`);
  }
}

async function handleMeterDisputeInput(phone: string, msg: string) {
  const s = sessions.get(phone);
  if (!s?.collected?.['_meterDisputeRideId']) return false;
  const rideId = parseInt(s.collected['_meterDisputeRideId']);
  const driverPrice = parseInt(s.collected['_meterDisputeDriverPrice'] || '0');
  const entered = parseFloat(msg);

  if (isNaN(entered) || entered <= 0) {
    await sendWA(phone, 'Please enter a valid amount in DKK.');
    return true;
  }

  // Save the dispute
  const ride = await (prisma as any).ride.findUnique({
    where: { id: rideId },
    select: { driverNote: true },
  });
  const note = (ride?.driverNote || '').replace('PENDING_CONFIRMATION', 'DISPUTED');
  const updatedNote = note.replace(/DRIVER:\d+/, `DRIVER:${driverPrice} | RIDER:${entered}`);

  await (prisma as any).ride.update({
    where: { id: rideId },
    data: {
      driverNote: updatedNote,
    },
  });

  // Send email to admins
  try {
    const admins = await prisma.user.findMany({
      where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] }, emailVerified: true },
      select: { email: true },
    });
    const adminEmails = admins.map(a => a.email).filter(Boolean);
    if (adminEmails.length > 0) {
      const { sendEmail } = await import('@/lib/email');
      await Promise.all(adminEmails.map(email =>
        sendEmail(email,
          `URGENT: Meter Price Dispute - Ride #${rideId}`,
          `<h2>Meter Price Dispute</h2>
          <p><strong>Ride #${rideId}</strong></p>
          <p><strong>Driver reported:</strong> ${driverPrice} DKK</p>
          <p><strong>Rider reported:</strong> ${entered} DKK</p>
          <p><strong>Difference:</strong> ${Math.abs(driverPrice - entered)} DKK</p>
          <p><strong>Status:</strong> DISPUTED - Requires investigation</p>
          <p>This may be an attempted overcharge. Please review immediately.</p>`).catch(() => {})
      ));
    }
  } catch {}

  delete s.collected['_meterDisputeRideId'];
  delete s.collected['_meterDisputeDriverPrice'];
  touch(s);

  await sendWA(phone, `Noted. The price has been recorded as ${entered} DKK. Our team will investigate and contact you if needed. Thank you.`);
  return true;
}

async function handleEditRideAddress(phone: string, rideId: number) {
  const user = await findUserByPhone(phone);
  let s = sessions.get(phone);
  const lang = (s?.collected?.['_language'] as 'ar' | 'dk' | 'en') || 'en';
  if (!s) {
    s = { phone, stage: 'booking', userId: user?.id || null, userExists: !!user, firstName: user?.firstName || '', collected: { _language: lang }, chatHistory: [], ts: Date.now() };
    touch(s);
  }
  if (!user) { await sendWA(phone, 'Not registered.'); return; }

  const ride = await (prisma as any).ride.findUnique({
    where: { id: rideId },
    select: { id: true, userId: true, driverId: true, status: true, pickupTime: true, pickupAddress: true, dropoffAddress: true, stopAddress: true, scheduled: true, price: true, vehicleTypeId: true, startLatLon: true, endLatLon: true },
  });
  if (!ride) {
    await sendWA(phone, lang === 'ar' ? '❌ الحجز غير موجود.' : lang === 'dk' ? '❌ Bookingen findes ikke.' : '❌ Ride not found.');
    return;
  }
  if (ride.userId !== user.id) {
    await sendWA(phone, lang === 'ar' ? '❌ هذا الحجز ليس لك.' : lang === 'dk' ? '❌ Denne booking er ikke din.' : '❌ This is not your ride.');
    return;
  }
  if (ride.driverId) {
    await sendWA(phone, lang === 'ar' ? '❌ لا يمكن تعديل عنوان الرحلة بعد تعيين سائق.' : lang === 'dk' ? '❌ Kan ikke ændre adresse efter en chauffør er tildelt.' : '❌ Cannot change address after a driver is assigned.');
    return;
  }
  if (!['CONFIRMED', 'PENDING'].includes(ride.status)) {
    await sendWA(phone, lang === 'ar' ? '❌ لا يمكن تعديل الرحلة في حالتها الحالية.' : lang === 'dk' ? '❌ Kan ikke ændre bookingen i dens nuværende tilstand.' : '❌ Cannot modify this ride in its current status.');
    return;
  }
  const minutesToPickup = (new Date(ride.pickupTime).getTime() - Date.now()) / 60000;
  if (minutesToPickup < 60) {
    await sendWA(phone, lang === 'ar' ? '❌ لا يمكن تعديل الرحلة قبل أقل من ساعة من موعد الانطلاق.' : lang === 'dk' ? '❌ Kan ikke ændre bookingen mindre end en time før afhentning.' : '❌ Cannot modify the ride less than 1 hour before pickup.');
    return;
  }

  // Ask which address to change
  s.collected['_editRideId'] = String(rideId);
  s.collected['_editOriginalPickup'] = ride.pickupAddress;
  s.collected['_editOriginalDropoff'] = ride.dropoffAddress;
  s.collected['_editOriginalStop'] = ride.stopAddress || '';
  s.stage = 'booking';
  s.collected['_awaitingEditChoice'] = 'true';
  touch(s);

  const buttons: { id: string; title: string }[] = lang === 'ar'
    ? [{ id: 'edit_pickup', title: '📍 الانطلاق' }, { id: 'edit_dropoff', title: '🏁 الوصول' }, { id: 'edit_stop', title: '🛑 المحطة' }]
    : lang === 'dk'
      ? [{ id: 'edit_pickup', title: '📍 Afhentning' }, { id: 'edit_dropoff', title: '🏁 Destination' }, { id: 'edit_stop', title: '🛑 Stop' }]
      : [{ id: 'edit_pickup', title: '📍 Pickup' }, { id: 'edit_dropoff', title: '🏁 Dropoff' }, { id: 'edit_stop', title: '🛑 Stop' }];

  const choiceMsg = lang === 'ar'
    ? `🔄 تعديل الرحلة #${rideId}\n\n📍 من: ${ride.pickupAddress}\n📍 إلى: ${ride.dropoffAddress}${ride.stopAddress ? `\n🛑 محطة: ${ride.stopAddress}` : ''}\n\nأي عنوان تريد تعديله؟`
    : lang === 'dk'
      ? `🔄 Rediger booking #${rideId}\n\n📍 Fra: ${ride.pickupAddress}\n📍 Til: ${ride.dropoffAddress}${ride.stopAddress ? `\n🛑 Stop: ${ride.stopAddress}` : ''}\n\nHvilken adresse vil du ændre?`
      : `🔄 Edit ride #${rideId}\n\n📍 From: ${ride.pickupAddress}\n📍 To: ${ride.dropoffAddress}${ride.stopAddress ? `\n🛑 Stop: ${ride.stopAddress}` : ''}\n\nWhich address would you like to change?`;

  await sendWAButtons(phone, choiceMsg, buttons);
}

async function handleEditAddressInput(phone: string, msg: string) {
  const s = sessions.get(phone);
  if (!s || !s.collected['_editRideId']) return false;
  const lang = (s.collected['_language'] as 'ar' | 'dk' | 'en') || 'en';
  const rideId = parseInt(s.collected['_editRideId']);
  const editField = s.collected['_editField'];

  if (!editField) return false;

  // User is providing the new address text
  delete s.collected['_editField'];
  touch(s);

  // Resolve the new address
  const resolved = await resolveAddress(msg, s.userId, '');
  if (!resolved) {
    const errMsg = lang === 'ar' ? '❌ لم يتم العثور على العنوان. الرجاء كتابة العنوان كاملاً مع الرمز البريدي والمدينة.' : lang === 'dk' ? '❌ Adressen blev ikke fundet. Skriv venligst den fulde adresse med postnummer og by.' : '❌ Address not found. Please write the full address with postal code and city.';
    await sendWA(phone, errMsg);
    return true;
  }

  // Get current ride for pricing
  const ride = await (prisma as any).ride.findUnique({
    where: { id: rideId },
    select: { pickupAddress: true, dropoffAddress: true, stopAddress: true, vehicleTypeId: true, pickupTime: true, price: true },
  });
  if (!ride) return true;

  // Build updated addresses for price estimation
  const tempSession: BotSession = {
    ...s,
    collected: {
      ...s.collected,
      pickupAddress: editField === 'pickup' ? resolved.address : ride.pickupAddress,
      dropoffAddress: editField === 'dropoff' ? resolved.address : ride.dropoffAddress,
      stopAddress: editField === 'stop' ? resolved.address : (ride.stopAddress || 'none'),
      vehicleTypeId: String(ride.vehicleTypeId),
      userId: String(s.userId),
    },
  };

  const estimate = await computePriceEstimate(tempSession);
  s.collected['_editNewAddress'] = resolved.address;
  s.collected['_editNewField'] = editField;
  s.collected['_awaitingConfirm'] = 'true';
  touch(s);

  let replyText = lang === 'ar'
    ? `📝 العنوان الجديد: ${resolved.address}\n\n📍 من: ${editField === 'pickup' ? resolved.address : ride.pickupAddress}\n📍 إلى: ${editField === 'dropoff' ? resolved.address : ride.dropoffAddress}`
    : lang === 'dk'
      ? `📝 Ny adresse: ${resolved.address}\n\n📍 Fra: ${editField === 'pickup' ? resolved.address : ride.pickupAddress}\n📍 Til: ${editField === 'dropoff' ? resolved.address : ride.dropoffAddress}`
      : `📝 New address: ${resolved.address}\n\n📍 From: ${editField === 'pickup' ? resolved.address : ride.pickupAddress}\n📍 To: ${editField === 'dropoff' ? resolved.address : ride.dropoffAddress}`;

  if (editField === 'stop') {
    replyText += lang === 'ar' ? `\n🛑 محطة: ${resolved.address}` : lang === 'dk' ? `\n🛑 Stop: ${resolved.address}` : `\n🛑 Stop: ${resolved.address}`;
  }

  if (estimate) {
    const priceLine = lang === 'ar'
      ? `\n\n💰 السعر التقديري الجديد: ${estimate.price} DKK (المسافة: ~${Math.round(estimate.distance * 10) / 10} كم)\n(السعر السابق: ${ride.price} DKK)`
      : lang === 'dk'
        ? `\n\n💰 Ny estimeret pris: ${estimate.price} DKK (afstand: ~${Math.round(estimate.distance * 10) / 10} km)\n(Tidligere pris: ${ride.price} DKK)`
        : `\n\n💰 New estimated price: ${estimate.price} DKK (distance: ~${Math.round(estimate.distance * 10) / 10} km)\n(Previous price: ${ride.price} DKK)`;
    replyText += priceLine;
    s.collected['_estimatedPrice'] = String(estimate.price);
  }

  const confirmButtons: { id: string; title: string }[] = lang === 'ar'
    ? [{ id: 'confirm', title: '✅ تأكيد' }, { id: 'discard', title: '❌ إلغاء' }]
    : lang === 'dk'
      ? [{ id: 'confirm', title: '✅ Bekræft' }, { id: 'discard', title: '❌ Annuller' }]
      : [{ id: 'confirm', title: '✅ Confirm' }, { id: 'discard', title: '❌ Discard' }];

  await sendWAButtons(phone, replyText, confirmButtons);
  return true;
}

async function handleEditRideConfirm(phone: string) {
  const s = sessions.get(phone);
  if (!s || !s.collected['_editRideId'] || !s.collected['_editNewAddress'] || !s.collected['_editNewField']) return;
  const lang = (s.collected['_language'] as 'ar' | 'dk' | 'en') || 'en';
  const rideId = parseInt(s.collected['_editRideId']);
  const field = s.collected['_editNewField'];
  const newAddress = s.collected['_editNewAddress'];

  // Re-resolve address for coordinates
  const resolved = await resolveAddress(newAddress, s.userId, '');
  if (!resolved) {
    await sendWA(phone, lang === 'ar' ? '❌ فشل تعديل العنوان.' : lang === 'dk' ? '❌ Kunne ikke opdatere adressen.' : '❌ Failed to update address.');
    return;
  }

  const updateData: any = {};
  if (field === 'pickup') {
    updateData.pickupAddress = resolved.address;
    updateData.startLatLon = { lat: resolved.lat, lon: resolved.lon };
  } else if (field === 'dropoff') {
    updateData.dropoffAddress = resolved.address;
    updateData.endLatLon = { lat: resolved.lat, lon: resolved.lon };
  } else if (field === 'stop') {
    updateData.stopAddress = resolved.address;
    updateData.stopLatLon = { lat: resolved.lat, lon: resolved.lon };
  }

  // Recalculate price
  try {
    const updatedRide = await (prisma as any).ride.findUnique({ where: { id: rideId }, select: { pickupAddress: true, dropoffAddress: true, stopAddress: true, vehicleTypeId: true, pickupTime: true, startLatLon: true, endLatLon: true, scheduled: true } });
    const merged = { ...updatedRide, ...updateData };
    const tempSession: BotSession = {
      ...s,
      collected: {
        pickupAddress: merged.pickupAddress,
        dropoffAddress: merged.dropoffAddress,
        stopAddress: merged.stopAddress || '',
        vehicleTypeId: merged.vehicleTypeId,
      },
    };
    const estimate = await computePriceEstimate(tempSession);

    await (prisma as any).ride.update({
      where: { id: rideId },
      data: { ...updateData, price: estimate?.price || updatedRide.price }
    });

    delete s.collected['_editRideId']; delete s.collected['_editNewAddress'];
    delete s.collected['_editNewField']; delete s.collected['_editOriginalPickup'];
    delete s.collected['_editOriginalDropoff']; delete s.collected['_editOriginalStop'];
    delete s.collected['_awaitingConfirm']; delete s.collected['_estimatedPrice'];
    s.stage = 'booking'; s.chatHistory = [];
    touch(s);

    const successMsg = lang === 'ar'
      ? `✅ تم تعديل العنوان بنجاح!\n\nالسعر الجديد: ${estimate?.price || 'N/A'} DKK`
      : lang === 'dk'
        ? `✅ Adresse opdateret!\n\nNy pris: ${estimate?.price || 'N/A'} DKK`
        : `✅ Address updated successfully!\n\nNew price: ${estimate?.price || 'N/A'} DKK`;
    await sendWA(phone, successMsg);
  } catch (e) {
    await sendWA(phone, lang === 'ar' ? '❌ فشل تعديل العنوان.' : lang === 'dk' ? '❌ Kunne ikke opdatere adressen.' : '❌ Failed to update address.');
    console.error('[WA EditRide]', e);
  }
}

async function handleRebook(phone: string, rideId: number) {
  // Find user by phone
  const user = await findUserByPhone(phone);
  if (!user) {
    await sendWA(phone, 'You are not registered. Send /reset to start registration.');
    return;
  }
  if (!user.emailVerified) {
    await sendWA(phone, 'Please verify your email first. Send /reset to restart.');
    return;
  }

  // Get or create session for language detection
  let s = sessions.get(phone);
  const lang = (s?.collected?.['_language'] as 'ar' | 'dk' | 'en') || detectLanguage('');
  if (!s) {
    s = { phone, stage: 'menu', userId: user.id, userExists: true, firstName: user.firstName, collected: { _language: lang }, chatHistory: [], ts: Date.now() };
    touch(s);
  }

  // Fetch the ride
  const ride = await (prisma as any).ride.findUnique({
    where: { id: rideId },
    select: {
      id: true, userId: true, pickupAddress: true, dropoffAddress: true, stopAddress: true,
      startLatLon: true, endLatLon: true,
      vehicleTypeId: true, paymentMethod: true,
      status: true, price: true, distanceKm: true, passengers: true,
    },
  });

  if (!ride) {
    const msg2 = lang === 'ar' ? '❌ الحجز غير موجود.' : lang === 'dk' ? '❌ Bookingen findes ikke.' : '❌ Booking not found.';
    await sendWA(phone, msg2);
    return;
  }

  // Check ownership
  if (ride.userId !== user.id) {
    const msg2 = lang === 'ar' ? '❌ هذا الحجز ليس لك.' : lang === 'dk' ? '❌ Denne booking er ikke din.' : '❌ This is not your booking.';
    await sendWA(phone, msg2);
    return;
  }

  // Check status - must be COMPLETED or CANCELLED (case-insensitive)
  const allowedStatuses = ['completed', 'cancelled', 'paid', 'canceled'];
  const rideStatus = (ride.status || '').toLowerCase();
  if (!allowedStatuses.includes(rideStatus)) {
    const msg2 = lang === 'ar'
      ? `❌ الحجز رقم ${rideId} ما زال نشطاً (${ride.status}). لا يمكن إعادة حجزه.`
      : lang === 'dk'
        ? `❌ Booking #${rideId} er stadig aktiv (${ride.status}). Kan ikke genoprettes.`
        : `❌ Booking #${rideId} is still active (${ride.status}). Cannot rebook it.`;
    await sendWA(phone, msg2);
    return;
  }

  // Copy ride details to session
  s.collected.pickupAddress = ride.pickupAddress;
  s.collected.dropoffAddress = ride.dropoffAddress;
  if (ride.stopAddress) s.collected.stopAddress = ride.stopAddress;
  s.collected.vehicleTypeId = String(ride.vehicleTypeId || 1);
  s.collected.paymentPreference = ride.paymentMethod === 'card' ? 'fixed' : 'meter';
  s.collected.pickupTime = 'now';
  delete s.collected.pickupTimeISO;
  delete s.collected['_awaitingConfirm'];
  s.collected['_awaitingConfirm'] = 'true';
  s.stage = 'payment';
  touch(s);

  const stopLine = ride.stopAddress ? (lang === 'ar' ? `\n🛑 محطة: ${ride.stopAddress}` : lang === 'dk' ? `\n🛑 Stop: ${ride.stopAddress}` : `\n🛑 Stop: ${ride.stopAddress}`) : '';

  // Show summary with updated price
  const estimate = await computePriceEstimate(s);
  let replyText = lang === 'ar'
    ? `🔄 إعادة حجز الرحلة ${rideId}\n\n📍 من: ${ride.pickupAddress}${stopLine}\n📍 إلى: ${ride.dropoffAddress}`
    : lang === 'dk'
      ? `🔄 Genopretter booking ${rideId}\n\n📍 Fra: ${ride.pickupAddress}${stopLine}\n📍 Til: ${ride.dropoffAddress}`
      : `🔄 Rebooking ride #${rideId}\n\n📍 From: ${ride.pickupAddress}${stopLine}\n📍 To: ${ride.dropoffAddress}`;

  if (estimate) {
    const priceLine = lang === 'ar'
      ? `\n\n🚕 ${estimate.vtName}\n💰 السعر التقديري: ${estimate.price} DKK (المسافة: ~${Math.round(estimate.distance * 10) / 10} كم)`
      : lang === 'dk'
        ? `\n\n🚕 ${estimate.vtName}\n💰 Estimeret pris: ${estimate.price} DKK (afstand: ~${Math.round(estimate.distance * 10) / 10} km)`
        : `\n\n🚕 ${estimate.vtName}\n💰 Estimated price: ${estimate.price} DKK (distance: ~${Math.round(estimate.distance * 10) / 10} km)`;
    replyText += priceLine;
    replyText += lang === 'ar'
      ? `\n(السعر السابق: ${ride.price} DKK)`
      : lang === 'dk'
        ? `\n(Tidligere pris: ${ride.price} DKK)`
        : `\n(Previous price: ${ride.price} DKK)`;
    s.collected['_estimatedPrice'] = String(estimate.price);
  }

  const summaryButtons: { id: string; title: string }[] = lang === 'ar'
    ? [{ id: 'confirm', title: '✅ تأكيد الحجز' }, { id: 'discard', title: '❌ إلغاء' }]
    : lang === 'dk'
      ? [{ id: 'confirm', title: '✅ Bekræft' }, { id: 'discard', title: '❌ Annuller' }]
      : [{ id: 'confirm', title: '✅ Confirm' }, { id: 'discard', title: '❌ Discard' }];

  await sendWAButtons(phone, replyText, summaryButtons);
}

async function computePriceEstimate(s: BotSession): Promise<{ price: number; distance: number; vtName: string } | null> {
  const rawPickup = s.collected.pickupAddress || '';
  const rawDropoff = s.collected.dropoffAddress || '';
  console.log('[WA estimate] pickup:', rawPickup, 'dropoff:', rawDropoff);
  if (!rawPickup || !rawDropoff) return null;

  let userSavedAddress = '';
  try {
    const u = await prisma.user.findUnique({ where: { id: s.userId! }, select: { address: true } });
    if (u) userSavedAddress = u.address;
  } catch {}

  const [pickupResolved, dropoffResolved] = await Promise.all([
    resolveAddress(rawPickup, s.userId, userSavedAddress),
    resolveAddress(rawDropoff, s.userId, userSavedAddress),
  ]);
  console.log('[WA estimate] resolved pickup:', pickupResolved, 'dropoff:', dropoffResolved);

  if (!pickupResolved || !dropoffResolved) {
    console.log('[WA estimate] address resolution failed for:', !pickupResolved ? 'pickup' : 'dropoff');
    return null;
  }

  let vid = 1;
  let vtName = 'Standard';
  if (s.collected.vehicleTypeId) vid = Number(s.collected.vehicleTypeId);
  else if (s.collected.vehicleTypePreference) {
    const result = await resolveVehicleType(s.collected.vehicleTypePreference);
    if (result.vt) { vid = result.vt.id; vtName = result.vt.title; }
  }

  // Resolve stop if present
  const rawStop = s.collected.stopAddress || '';
  let stopResolved: ResolvedAddress | null = null;
  if (rawStop && rawStop !== 'none' && rawStop !== 'لا' && rawStop !== 'no') {
    stopResolved = await resolveAddress(rawStop, s.userId, userSavedAddress);
  }

  // Calculate distance — with stop if present (pickup → stop → dropoff)
  let dist = 0, dur = 0;
  try {
    const { safeEstimateDistance } = await import('@/lib/geocode-safe');

    if (stopResolved) {
      const leg1 = await safeEstimateDistance(
        { address: pickupResolved.address, lat: pickupResolved.lat, lon: pickupResolved.lon },
        { address: stopResolved.address, lat: stopResolved.lat, lon: stopResolved.lon }
      );
      const leg2 = await safeEstimateDistance(
        { address: stopResolved.address, lat: stopResolved.lat, lon: stopResolved.lon },
        { address: dropoffResolved.address, lat: dropoffResolved.lat, lon: dropoffResolved.lon }
      );
      dist = leg1.distanceKm + leg2.distanceKm;
      dur = leg1.durationMin + leg2.durationMin;
    } else {
      const r = await safeEstimateDistance(
        { address: pickupResolved.address, lat: pickupResolved.lat, lon: pickupResolved.lon },
        { address: dropoffResolved.address, lat: dropoffResolved.lat, lon: dropoffResolved.lon }
      );
      dist = r.distanceKm;
      dur = r.durationMin;
    }
    console.log('[WA estimate] distance:', dist, 'km, duration:', dur, 'min');
  } catch (e) { console.error('[WA estimate] distance failed:', e); return null; }

  if (dist < 0.1) { console.log('[WA estimate] distance too short (<0.1km), returning null'); return null; }

  const pTime = new Date();
  const { computePrice } = await import('@/lib/price');
  const price = await computePrice(dist, dur, pTime, vid, { isScheduled: false });
  console.log('[WA estimate] price:', price, 'DKK, vehicle:', vtName, 'id:', vid);

  return { price, distance: dist, vtName };
}

async function handleConfirmBooking(s: BotSession, phone: string, lang: 'ar' | 'dk' | 'en') {
  const paymentChoice = s.collected.paymentPreference || 'meter';

  const errorMessages: Record<string, Record<string, string>> = {
    route_failed: { ar: '❌ تعذر حساب المسار. تحقق من العناوين.', dk: '❌ Kunne ikke beregne rute. Tjek adresserne.', en: '❌ Could not calculate route. Please check addresses.' },
    distance_too_short: { ar: '❌ المسافة قريبة جداً.', dk: '❌ Afstanden er for kort.', en: '❌ Distance too short.' },
    pickup_not_found: { ar: '❌ لم يتم العثور على عنوان الالتقاط. الرجاء كتابة العنوان كاملاً مع الرمز البريدي والمدينة.', dk: '❌ Afhentningsadressen blev ikke fundet. Skriv venligst den fulde adresse med postnummer og by.', en: '❌ Pickup address not found. Please write the full address with postal code and city.' },
    dropoff_not_found: { ar: '❌ لم يتم العثور على عنوان الوجهة. الرجاء كتابة العنوان كاملاً مع الرمز البريدي والمدينة.', dk: '❌ Destinationsadressen blev ikke fundet. Skriv venligst den fulde adresse med postnummer og by.', en: '❌ Dropoff address not found. Please write the full address with postal code and city.' },
  };

  if (paymentChoice === 'fixed') {
    await sendWA(phone, MSG.bookingCreating[lang]);

    const book = await doCreateBooking(s, 'fixed');
    if (!book.ok) {
      if (book.error === 'pickup_not_found') delete s.collected.pickupAddress;
      if (book.error === 'dropoff_not_found') delete s.collected.dropoffAddress;
      // Clear awaiting confirm so cancel message doesn't try to cancel a non-existent booking
      delete s.collected['_awaitingConfirm'];
      await sendWA(phone, (errorMessages[book.error!] || { en: `❌ ${book.error}` })[lang] || `❌ ${book.error}`); touch(s); return;
    }

    const resolvedFrom = book.resolvedPickup || s.collected.pickupAddress || '';
    const resolvedTo = book.resolvedDropoff || s.collected.dropoffAddress || '';

    const lastBookingId = book.id!;
    const lastBookingTs = Date.now();
    s.stage = 'menu'; s.collected = { _language: lang };
    s.collected['_lastBookingId'] = String(lastBookingId);
    s.collected['_lastBookingTs'] = String(lastBookingTs);
    touch(s);

    try {
      const baseUrl = process.env.PUBLIC_BASE_URL || 'http://localhost:3000';
      const { url } = await createWhatsAppPaymentSession({
        bookingId: book.id!,
        amount: book.price!,
        userPhone: phone,
        baseUrl,
      });

      await sendWA(phone, MSG.bookingCard(book.id!, book.vtName!, resolvedFrom, resolvedTo, book.price!, url, lang, s.collected.stopAddress || undefined));
    } catch (e) {
      console.error('[WA Stripe]', e);
      await sendWA(phone, '❌ Failed to create payment link. Please try again.');
    }
    return;
  }

  await sendWA(phone, MSG.bookingCreatingMeter[lang]);

  const book = await doCreateBooking(s, 'meter');
  if (!book.ok) {
    if (book.error === 'pickup_not_found') delete s.collected.pickupAddress;
    if (book.error === 'dropoff_not_found') delete s.collected.dropoffAddress;
    delete s.collected['_awaitingConfirm'];
    await sendWA(phone, (errorMessages[book.error!] || { en: `❌ ${book.error}` })[lang] || `❌ ${book.error}`); touch(s); return;
  }

  const resolvedFrom = book.resolvedPickup || s.collected.pickupAddress || '';
  const resolvedTo = book.resolvedDropoff || s.collected.dropoffAddress || '';

  const timeDisplay = s.collected.pickupTime === 'now'
    ? (lang === 'dk' ? 'NU' : lang === 'en' ? 'Now' : 'فوري')
    : (s.collected.pickupTime || '---');

  const lastBookingId = book.id!;
  const lastBookingTs = Date.now();
  s.stage = 'menu'; s.collected = { _language: lang };
  s.collected['_lastBookingId'] = String(lastBookingId);
  s.collected['_lastBookingTs'] = String(lastBookingTs);
  touch(s);

  await sendWA(phone, MSG.bookingCash(book.id!, book.vtName!, resolvedFrom, resolvedTo, timeDisplay, book.price!, lang, s.collected.stopAddress || undefined));
}

// ========================
// Vehicle type resolver
// ========================

interface VehicleTypeInfo {
  id: number;
  key: string;
  title: string;
  capacity: number;
  multiplier: number;
}

const VEHICLE_HINTS: Record<string, string> = {
  'sedan': 'SEDAN5', 'car': 'SEDAN5', 'bil': 'SEDAN5', 'سيارة': 'SEDAN5', 'عادية': 'SEDAN5', 'سياره': 'SEDAN5', 'standard': 'SEDAN5', 'normal': 'SEDAN5', 'almindelig': 'SEDAN5',
  'seven': 'SEVEN_NO_BAG', '7seater': 'SEVEN_NO_BAG', 'six': 'SEVEN_NO_BAG', '7pass': 'SEVEN_NO_BAG', '7person': 'SEVEN_NO_BAG', 'stor': 'SEVEN_NO_BAG', 'كبيرة': 'SEVEN_NO_BAG',
  'van': 'VAN', 'minibus': 'VAN', 'nine': 'VAN', 'فان': 'VAN', 'باص': 'VAN', 'ميكروباص': 'VAN', 'minivan': 'VAN',
  'limo': 'LIMO', 'lux': 'LIMO', 'luxury': 'LIMO', 'luksus': 'LIMO', 'لوكس': 'LIMO', 'فخم': 'LIMO', 'فخمة': 'LIMO', 'لكزس': 'LIMO',
};

// Map list position numbers (1-4) to vehicle keys based on display order
const LIST_NUMBER_TO_KEY: Record<string, string> = {
  '1': 'SEDAN5',
  '2': 'SEVEN_NO_BAG',
  '3': 'VAN',
  '4': 'LIMO',
};

async function resolveVehicleType(input: string): Promise<{ vt: VehicleTypeInfo | null; note: string }> {
  const text = input.toLowerCase().trim();

  const allTypes = await (prisma as any).vehicleType.findMany({
    where: { active: true },
    select: { id: true, key: true, title: true, capacity: true, multiplier: true },
  }) as VehicleTypeInfo[];

  if (allTypes.length === 0) return { vt: null, note: 'no_vehicle_types' };

  // Handle list position numbers (1-4) from display order
  const trimmedText = text.trim();
  if (['1', '2', '3', '4'].includes(trimmedText)) {
    const key = LIST_NUMBER_TO_KEY[trimmedText];
    const vt = allTypes.find(t => t.key === key);
    if (vt) return { vt, note: '' };
  }

  // Try hint match
  let matchedKey: string | null = null;
  for (const [hint, key] of Object.entries(VEHICLE_HINTS)) {
    if (text.includes(hint)) { matchedKey = key; break; }
  }

  if (matchedKey) {
    const vt = allTypes.find(t => t.key === matchedKey);
    if (vt) {
      // Check if user mentioned luggage/baggage with a small car
      const mentionsLuggage = /bag|baggage|luggage|أغراض|شنط|شنطة|اغراض|حقيبة|حقائب|taske|kuffert/i.test(input);
      const mentionsManyPassengers = /\b([5-9]|1[0-6])\b.*(passenger|person|people|راكب|ركاب|شخص|أشخاص|اشخاص|personer|passager)/i.test(input)
        || /(passenger|person|people|راكب|ركاب|شخص|أشخاص|اشخاص|personer|passager).*\b([5-9]|1[0-6])\b/i.test(input);

      // If user chose sedan but has luggage → suggest VAN or SEVEN_NO_BAG
      if (matchedKey === 'SEDAN5' && (mentionsLuggage || mentionsManyPassengers)) {
        // Prefer SEVEN_NO_BAG if available, else VAN
        const seven = allTypes.find(t => t.key === 'SEVEN_NO_BAG');
        const van = allTypes.find(t => t.key === 'VAN');
        if (seven) return { vt: seven, note: 'upgraded_for_luggage' };
        if (van) return { vt: van, note: 'upgraded_for_luggage' };
      }

      // If user said "7" but means 7 people, check SEVEN_NO_BAG capacity
      if (matchedKey === 'SEVEN_NO_BAG' && mentionsLuggage) {
        const van = allTypes.find(t => t.key === 'VAN');
        if (van) return { vt: van, note: 'upgraded_for_luggage' };
      }

      return { vt, note: '' };
    }
  }

  // Try to extract a number from input (e.g., "4 passengers", "6 people")
  // Skip if the input is just a single digit 1-4 (already handled as list position)
  if (!['1','2','3','4'].includes(trimmedText)) {
    const numMatch = text.match(/\b(\d{1,2})\b/);
    if (numMatch) {
      const num = parseInt(numMatch[1]);
      if (num >= 1 && num <= 16) {
        // Find smallest vehicle that fits
        const fits = allTypes
          .filter(t => t.capacity >= num)
          .sort((a, b) => a.capacity - b.capacity);
        if (fits.length > 0) {
          const vt = fits[0];
          const mentionsLuggage = /bag|baggage|luggage|أغراض|شنط|شنطة|اغراض|حقيبة|حقائب|taske|kuffert/i.test(input);
          if (mentionsLuggage && fits.length > 1 && fits[1]) {
            return { vt: fits[1], note: 'upgraded_for_luggage' };
          }
          return { vt, note: '' };
        }
      }
    }
  }

  // Try fuzzy match on title
  for (const vt of allTypes) {
    if (text.includes(vt.title.toLowerCase())) return { vt, note: '' };
  }

  return { vt: null, note: '' };
}

async function findAirportAddress(userLang = 'ar'): Promise<{ address: string; lat: number; lon: number } | null> {
  // Copenhagen Airport (default for Denmark)
  const airports: Record<string, { address: string; lat: number; lon: number }> = {
    cph: { address: 'Copenhagen Airport, Lufthavnsboulevarden 6, 2770 Kastrup, Denmark', lat: 55.6180, lon: 12.6508 },
    aar: { address: 'Aarhus Airport, Ny Lufthavnsvej 24, 8560 Kolind, Denmark', lat: 56.3042, lon: 10.6193 },
    aal: { address: 'Aalborg Airport, Ny Lufthavnsvej 100, 9400 Nørresundby, Denmark', lat: 57.0930, lon: 9.8494 },
    bll: { address: 'Billund Airport, Passagerterminalen 10, 7190 Billund, Denmark', lat: 55.7403, lon: 9.1518 },
  };

  // Try Google Places first for "airport near user"
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (apiKey) {
    try {
      const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=lufthavn+denmark&region=dk&key=${apiKey}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      const data = await res.json();
      if (data.status === 'OK' && data.results?.[0]) {
        const r = data.results[0];
        return { address: r.formatted_address || r.name, lat: r.geometry.location.lat, lon: r.geometry.location.lng };
      }
    } catch {}
  }

  // Fallback to CPH
  return airports.cph;
}

async function resolveAddress(
  input: string,
  userId: number | null,
  userSavedAddress: string
): Promise<ResolvedAddress | null> {
  const text = input.trim().toLowerCase();

  // ---- "home" / "البيت" / "hjem" ----
  if (['home', 'بيت', 'البيت', 'hjem', 'hjemme', 'hus', 'adresse'].some(k => text.includes(k))) {
    if (userSavedAddress) {
      const result = await geocodeGoogle(userSavedAddress) || await geocodeNominatim(userSavedAddress);
      if (result) {
        return { address: result.address, lat: result.lat, lon: result.lon, source: 'user_profile' };
      }
    }
    if (userSavedAddress) {
      return { address: userSavedAddress, lat: 55.838, lon: 12.062, source: 'fallback' };
    }
  }

  // ---- Favorites lookup ----
  if (userId) {
    try {
      const favs = await prisma.favoriteaddress.findMany({
        where: { userId },
        select: { label: true, address: true, lat: true, lon: true },
      });
      for (const fav of favs) {
        if (text.includes(fav.label.toLowerCase()) || fav.label.toLowerCase().includes(text)) {
          if (fav.lat && fav.lon) {
            return { address: fav.address, lat: fav.lat, lon: fav.lon, source: 'favorite' };
          }
          const result = await geocodeGoogle(fav.address) || await geocodeNominatim(fav.address);
          if (result) {
            return { address: result.address, lat: result.lat, lon: result.lon, source: 'favorite' };
          }
          return { address: fav.address, lat: 55.838, lon: 12.062, source: 'favorite' };
        }
      }
    } catch {}
  }

  // ---- "airport" / "مطار" / "lufthavn" ----
  if (['airport', 'مطار', 'المطار', 'lufthavn', 'fly', 'terminal'].some(k => text.includes(k))) {
    const airport = await findAirportAddress();
    if (airport) return { ...airport, source: 'airport' };
  }

  // ---- Geocode normally ----
  const result = await geocodeGoogle(input) || await geocodeNominatim(input);
  if (result) {
    return { address: result.address, lat: result.lat, lon: result.lon, source: 'geocoded' };
  }

  // Failed to resolve - return null so caller can ask user for a better address
  return null;
}

// ========================
// Booking creation (now with coordinate resolution)
// ========================

async function doCreateBooking(
  session: BotSession,
  paymentMethod: 'meter' | 'fixed'
): Promise<{ ok: boolean; id?: number; price?: number; vtName?: string; resolvedPickup?: string; resolvedDropoff?: string; error?: string }> {
  const { collected: c, userId: uid } = session;
  if (!uid) return { ok: false, error: 'User unknown' };

  const rawPickup = c.pickupAddress || '', rawDropoff = c.dropoffAddress || '';
  const rawStop = c.stopAddress || '';
  if (!rawPickup || !rawDropoff) return { ok: false, error: 'Missing address' };

  // Fetch user for saved address
  let userSavedAddress = '';
  try {
    const u = await prisma.user.findUnique({ where: { id: uid }, select: { address: true } });
    if (u) userSavedAddress = u.address;
  } catch {}

  // Resolve addresses with coordinates
  const rawStopAddr = (rawStop && rawStop !== 'none' && rawStop !== 'لا' && rawStop !== 'no') ? rawStop : null;

  const [pickupResolved, dropoffResolved] = await Promise.all([
    resolveAddress(rawPickup, uid, userSavedAddress),
    resolveAddress(rawDropoff, uid, userSavedAddress),
  ]);

  if (!pickupResolved) return { ok: false, error: 'pickup_not_found', failedAddress: rawPickup };
  if (!dropoffResolved) return { ok: false, error: 'dropoff_not_found', failedAddress: rawDropoff };

  session.collected.pickupAddress = pickupResolved.address;
  session.collected.dropoffAddress = dropoffResolved.address;

  let stopResolved: ResolvedAddress | null = null;
  if (rawStopAddr) {
    stopResolved = await resolveAddress(rawStopAddr, uid, userSavedAddress);
    if (stopResolved) {
      session.collected.stopAddress = stopResolved.address;
    }
  }

  let vid = 1;
  if (c.vehicleTypeId) vid = Number(c.vehicleTypeId);
  else if (c.vehicleTypePreference) {
    const result = await resolveVehicleType(c.vehicleTypePreference);
    if (result.vt) {
      vid = result.vt.id;
      c.vehicleTypeName = result.vt.title;
      // Store note for feedback in session (optional)
      if (result.note) c._vtNote = result.note;
    } else {
      // Fallback: try contains match on title
      const vt = await (prisma as any).vehicleType.findFirst({
        where: { active: true, title: { contains: c.vehicleTypePreference } },
        select: { id: true, title: true },
      });
      if (vt) { vid = vt.id; c.vehicleTypeName = vt.title; }
    }
  }
  // Calculate distance — with stop if present (pickup → stop → dropoff)
  let dist = 0, dur = 0;
  try {
    const { safeEstimateDistance } = await import('@/lib/geocode-safe');

    if (stopResolved) {
      // Leg 1: pickup → stop
      const leg1 = await safeEstimateDistance(
        { address: pickupResolved.address, lat: pickupResolved.lat, lon: pickupResolved.lon },
        { address: stopResolved.address, lat: stopResolved.lat, lon: stopResolved.lon }
      );
      // Leg 2: stop → dropoff
      const leg2 = await safeEstimateDistance(
        { address: stopResolved.address, lat: stopResolved.lat, lon: stopResolved.lon },
        { address: dropoffResolved.address, lat: dropoffResolved.lat, lon: dropoffResolved.lon }
      );
      dist = leg1.distanceKm + leg2.distanceKm;
      dur = leg1.durationMin + leg2.durationMin;
    } else {
      const r = await safeEstimateDistance(
        { address: pickupResolved.address, lat: pickupResolved.lat, lon: pickupResolved.lon },
        { address: dropoffResolved.address, lat: dropoffResolved.lat, lon: dropoffResolved.lon }
      );
      dist = r.distanceKm;
      dur = r.durationMin;
    }
  } catch { return { ok: false, error: 'route_failed' }; }

  if (dist < 0.1) return { ok: false, error: 'distance_too_short' };

  const isSched = !!(c.pickupTimeISO && c.pickupTime !== 'now' && c.pickupTime !== 'الآن' && c.pickupTime !== 'nu');
  let pTime: Date;
  if (c.pickupTimeISO) { pTime = new Date(c.pickupTimeISO); if (isNaN(pTime.getTime())) pTime = new Date(); }
  else pTime = new Date();

  const { computePrice } = await import('@/lib/price');
  const price = await computePrice(dist, dur, pTime, vid, { isScheduled: isSched });

  const isMeter = paymentMethod === 'meter';

  const booking = await (prisma as any).ride.create({
    data: {
      userId: uid, riderName: session.firstName || 'User', passengers: 1,
      pickupAddress: pickupResolved.address, dropoffAddress: dropoffResolved.address,
      stopAddress: stopResolved?.address || (rawStop && rawStop !== 'none' && rawStop !== 'لا' && rawStop !== 'no' ? rawStop : null),
      startLatLon: { lat: pickupResolved.lat, lon: pickupResolved.lon },
      endLatLon: { lat: dropoffResolved.lat, lon: dropoffResolved.lon },
      stopLatLon: stopResolved ? { lat: stopResolved.lat, lon: stopResolved.lon } : null,
      scheduled: isSched, pickupTime: pTime,
      distanceKm: Math.round(dist * 100) / 100, durationMin: dur, price,
      status: isMeter ? 'CONFIRMED' : 'PENDING',
      paymentStatus: isMeter ? 'PAID' : 'UNPAID',
      paymentMethod: isMeter ? 'meter' : 'card',
      explanation: isMeter
        ? 'WhatsApp booking - cash payment (meter)'
        : 'WhatsApp booking - awaiting card payment via Stripe',
      driverNote: isMeter ? 'CASH - METER RIDE' : null,
      vehicleTypeId: vid, driverQueue: [],
    },
    include: { vehicleType: { select: { title: true } } },
  });

  return {
    ok: true, id: booking.id, price: booking.price,
    vtName: (booking as any).vehicleType?.title || c.vehicleTypeName || 'Standard',
    resolvedPickup: pickupResolved.address, resolvedDropoff: dropoffResolved.address,
  };
}

// ========================
// WhatsApp Messaging
// ========================

let waPhoneId = '', waToken = '';
function initWACreds() {
  waPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
  waToken = process.env.WHATSAPP_ACCESS_TOKEN || '';
}

async function sendWA(to: string, text: string) {
  if (!waPhoneId) initWACreds();
  if (!waPhoneId || !waToken) return;

  try {
    await fetch(`https://graph.facebook.com/${WHATSAPP_API_VERSION}/${waPhoneId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${waToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to, type: 'text', text: { preview_url: false, body: text } }),
    });
  } catch {}
}

async function sendWAButtons(to: string, bodyText: string, buttons: { id: string; title: string }[], footerText?: string) {
  if (!waPhoneId) initWACreds();
  if (!waPhoneId || !waToken) {
    // Fallback: send as text with numbered list
    const btnList = buttons.map((b, i) => `${i + 1}. ${b.title}`).join('\n');
    await sendWA(to, `${bodyText}\n\n${btnList}${footerText ? '\n' + footerText : ''}`);
    return;
  }

  try {
    const interactive: any = {
      type: 'button',
      body: { text: bodyText },
      action: { buttons: buttons.map(b => ({ type: 'reply', reply: { id: b.id, title: b.title.substring(0, 20) } })) },
    };
    if (footerText) interactive.footer = { text: footerText };

    await fetch(`https://graph.facebook.com/${WHATSAPP_API_VERSION}/${waPhoneId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${waToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to, type: 'interactive', interactive }),
    });
  } catch {}
}

// ========================
// Quick keyword replies — now use RESET_MSG for greetings
// ========================

const GREETING_WORDS: Record<string, string[]> = {
  ar: ['مرحبا', 'هلا', 'السلام عليكم', 'مراحب', 'اهلا', 'أهلا', 'صباح الخير', 'مساء الخير', 'سلام'],
  dk: ['hej', 'hejsa', 'halløj', 'goddag', 'godmorgen', 'godaften', 'davs'],
  en: ['hello', 'hi', 'hey', 'good morning', 'good evening', 'howdy', 'yo', 'sup'],
};

function isGreeting(text: string): { lang: 'ar' | 'dk' | 'en' } | null {
  const lower = text.toLowerCase().trim();
  for (const lang of ['en', 'ar', 'dk'] as const) {
    for (const word of GREETING_WORDS[lang]) {
      if (lower === word.toLowerCase() || lower.startsWith(word.toLowerCase() + ' ')) {
        return { lang };
      }
    }
  }
  return null;
}

// ========================
// Background processing
// ========================

async function processInBackground(phone: string, text: string, contactName: string) {
  try { await handleMessage(phone, text, contactName); }
  catch (e) { console.error('[WA BG]', e); }
}

// ========================
// Core Handler
// ========================

async function handleMessage(phone: string, text: string, contactName: string) {
  const msg = text.trim();

  // ---- Reset ----
  // ToLower for fast matching
  const cancelLower = msg.toLowerCase();

  // Help keywords
  if (cancelLower === 'help' || cancelLower === 'hjælp' || cancelLower === 'hjaelp' || cancelLower === 'مساعدة' || cancelLower === 'مساعده' || cancelLower === 'اوامر' || cancelLower === 'أوامر' || cancelLower === 'commands' || cancelLower === 'kommandoer') {
    const lang = detectLanguage(msg);
    await sendWA(phone, HELP_MSG[lang]);
    return;
  }

  if (msg === '/reset' || msg === '/start') {
    sessions.delete(phone);
    const u = await findUserByPhone(phone);
    if (u) {
      if (!u.emailVerified) {
        const lang = detectLanguage(msg);
        const sess: BotSession = { phone, stage: 'verify_email', userId: u.id, userExists: true, firstName: u.firstName, collected: { _language: lang }, chatHistory: [], ts: Date.now() };
        touch(sess);
        await sendWA(phone, MSG.verifyPrompt[lang](u.firstName, u.email));
        return;
      }
      const lang = detectLanguage(msg);
      const sess: BotSession = { phone, stage: 'booking', userId: u.id, userExists: true, firstName: u.firstName, collected: { _language: lang }, chatHistory: [], ts: Date.now() };
      touch(sess);
      await sendWA(phone, RESET_MSG[lang].replace('{name}', u.firstName));
    } else {
      touch({ phone, stage: 'registration', userId: null, userExists: false, firstName: '', collected: {}, chatHistory: [], ts: Date.now() });
      await sendWA(phone, 'Welcome to 944 Trafik! 🚕\n\nLet\'s start with registration. What is your first name?');
    }
    return;
  }

  // ---- Chat forwarding & endchat (checks DB, not session) ----

  // ---- Edit ride address (for scheduled rides) ----
  // Commands: "edit 150", "تعديل 150", "rediger 150", "تغيير عنوان 150", "ændre 150"
  const editRideMatch = msg.match(/(?:edit|تعديل|rediger|تغيير عنوان|تغيير|ændr[e]?)\s*#?\s*(\d+)/i);
  if (editRideMatch) {
    await handleEditRideAddress(phone, parseInt(editRideMatch[1]));
    return;
  }

  // ---- Chat forwarding & endchat (checks DB, not session) ----

  // End chat command — stops forwarding to driver
  if (cancelLower === 'endchat' || cancelLower === 'إنهاء' || cancelLower === 'انهاء' || cancelLower === 'slut') {
    const existing = sessions.get(phone);
    const lang = existing?.collected?.['_language'] || detectLanguage(msg);
    if (existing?.collected?.['_chatRideId']) {
      delete existing.collected['_chatRideId'];
      touch(existing);
    }
    const endMsg = lang === 'ar' ? '✅ تم إنهاء الدردشة مع السائق. يمكنك الآن حجز رحلة جديدة.' : lang === 'dk' ? '✅ Chat med chauffør afsluttet. Du kan nu bestille en ny tur.' : '✅ Chat with driver ended. You can now book a new ride.';
    await sendWA(phone, endMsg);
    return;
  }

  // ---- Meter price confirmation (from WhatsApp buttons) ----
  const meterYesMatch = msg.match(/^meter_yes_(\d+)$/);
  const meterNoMatch = msg.match(/^meter_no_(\d+)$/);
  if (meterYesMatch || meterNoMatch) {
    const rideId = parseInt(meterYesMatch ? meterYesMatch[1] : meterNoMatch![1]);
    const isYes = !!meterYesMatch;
    await handleMeterConfirmation(phone, rideId, isYes);
    return;
  }

  // ---- Meter dispute: rider entering actual price ----
  {
    const existing = sessions.get(phone);
    if (existing?.collected?.['_meterDisputeRideId']) {
      const handled = await handleMeterDisputeInput(phone, msg);
      if (handled) return;
    }
  }

  // Forward to driver if rider has an active dispatched/ongoing ride that hasn't been picked up yet
  if (msg.length > 0 && !msg.startsWith('/')
      && cancelLower !== 'cancel' && cancelLower !== 'confirm'
      && cancelLower !== 'discard' && cancelLower !== 'resend'
      && cancelLower !== 'endchat' && cancelLower !== 'إنهاء' && cancelLower !== 'انهاء' && cancelLower !== 'slut') {

    const user = await findUserByPhone(phone);
    if (user) {
      const activeRide = await (prisma as any).ride.findFirst({
        where: {
          userId: user.id,
          status: { in: ['DISPATCHED', 'ONGOING'] },
          driverId: { not: null },
        },
        orderBy: { createdAt: 'desc' },
        select: { id: true, status: true },
      });

      if (activeRide) {
        const io = (global as any).io;
        if (io) {
          io.to(`chat_${activeRide.id}`).emit('newMessage', {
            bookingId: activeRide.id, message: msg, sender: user.firstName || 'Customer', timestamp: new Date().toISOString()
          });
          try {
            await (prisma as any).chatMessage.create({
              data: { rideId: activeRide.id, sender: 'rider', message: msg, source: 'whatsapp' }
            });
          } catch {}
        }
        return;
      }
    }
  }

  // ---- Fast keyword check (greetings) ----
  const greeting = isGreeting(msg);
  if (greeting) {
    const lang = greeting.lang;
    const existing = sessions.get(phone);

    // Check database if no session or user not flagged in session
    let isRegistered = existing?.userExists || false;
    let dbUser = null;
    if (!isRegistered) {
      dbUser = await findUserByPhone(phone);
      isRegistered = !!dbUser;
    }

    if (isRegistered) {
      const u = dbUser || (existing?.userId ? await findUserByPhone(phone) : null) || { firstName: 'there' } as any;
      const name = u?.firstName || existing?.firstName || (lang === 'ar' ? 'مرحباً' : 'there');
      const sess: BotSession = {
        phone, stage: 'booking', userId: existing?.userId || u?.id || null,
        userExists: true, firstName: name,
        collected: { _language: lang }, chatHistory: [], ts: Date.now(),
      };
      touch(sess);
      await sendWA(phone, RESET_MSG[lang]);
    } else {
      // New user — start registration
      const s2: BotSession = { phone, stage: 'registration', userId: null, userExists: false, firstName: '', collected: { _language: lang }, chatHistory: [], ts: Date.now() };
      touch(s2);
      await sendWA(phone, 'Welcome to 944 Trafik! 🚕\n\nLet\'s start with registration. What is your first name?');
    }
    return;
  }

  // ---- Cancel booking (within 3 min) ----
  if (cancelLower === 'cancel' || cancelLower === 'إلغاء' || cancelLower === 'الغاء' || cancelLower === 'annuller') {
    const existing = sessions.get(phone);
    const lang = existing?.collected?.['_language'] || detectLanguage(msg);
    const bookingId = existing?.collected?.['_lastBookingId'];
    const bookingTs = existing?.collected?.['_lastBookingTs'];

    // If no booking to cancel but awaiting confirm, just discard the pending booking
    if ((!bookingId || !bookingTs) && existing?.collected?.['_awaitingConfirm'] === 'true') {
      existing.collected = { _language: lang };
      existing.chatHistory = [];
      existing.stage = 'booking';
      delete existing.collected['_awaitingConfirm'];
      touch(existing);
      await sendWA(phone, MSG.cancelSuccess[lang]);
      await sendWA(phone, RESET_MSG[lang]);
      return;
    }

    if (!bookingId || !bookingTs) {
      await sendWA(phone, MSG.noBookingToCancel[lang]);
      return;
    }
    const elapsedMs = Date.now() - Number(bookingTs);
    if (elapsedMs > 3 * 60 * 1000) {
      await sendWA(phone, MSG.cancelExpired[lang]);
      return;
    }
    try {
      await (prisma as any).ride.update({
        where: { id: Number(bookingId) },
        data: { status: 'CANCELLED' },
      });
      if (existing) {
        existing.collected = { _language: lang };
        existing.chatHistory = [];
        existing.stage = 'booking';
        delete existing.collected['_lastBookingId'];
        delete existing.collected['_lastBookingTs'];
        touch(existing);
      }
      await sendWA(phone, MSG.cancelSuccess[lang]);
      await sendWA(phone, RESET_MSG[lang]);
    } catch (e) {
      console.error('[WA Cancel]', e);
      await sendWA(phone, MSG.cancelFailed[lang]);
    }
    return;
  }

  // ---- Confirm booking (after summary / edit ride) ----
  if (cancelLower === 'confirm' || cancelLower === 'تأكيد' || cancelLower === 'تاكيد' || cancelLower === 'bekræft') {
    const existing = sessions.get(phone);
    // Check if this is an edit ride confirmation
    if (existing?.collected?.['_editRideId'] && existing.collected['_awaitingConfirm'] === 'true') {
      delete existing.collected['_awaitingConfirm'];
      touch(existing);
      await handleEditRideConfirm(phone);
      return;
    }
    if (existing && existing.collected['_awaitingConfirm'] === 'true') {
      delete existing.collected['_awaitingConfirm'];
      touch(existing);
      await handleConfirmBooking(existing, phone, (existing.collected['_language'] as 'ar' | 'dk' | 'en') || 'en');
    } else {
      const lang = existing?.collected?.['_language'] || detectLanguage(msg);
      await sendWA(phone, lang === 'ar' ? 'لا يوجد حجز بانتظار التأكيد. أرسل /reset للبدء من جديد.' : lang === 'dk' ? 'Ingen booking venter på bekræftelse. Send /reset for at starte forfra.' : 'No booking awaiting confirmation. Send /reset to start over.');
    }
    return;
  }

  // ---- Discard booking / edit ride ----
  if (cancelLower === 'discard' || cancelLower === 'تجاهل') {
    const existing = sessions.get(phone);
    // Check if discarding an edit ride
    if (existing?.collected?.['_editRideId'] && existing.collected['_awaitingConfirm'] === 'true') {
      const lang = (existing.collected['_language'] as 'ar' | 'dk' | 'en') || 'en';
      delete existing.collected['_editRideId']; delete existing.collected['_editNewAddress'];
      delete existing.collected['_editNewField']; delete existing.collected['_editOriginalPickup'];
      delete existing.collected['_editOriginalDropoff']; delete existing.collected['_editOriginalStop'];
      delete existing.collected['_awaitingConfirm']; delete existing.collected['_estimatedPrice'];
      existing.collected = { _language: lang }; existing.chatHistory = []; existing.stage = 'booking';
      touch(existing);
      await sendWA(phone, RESET_MSG[lang]);
      return;
    }
    if (existing && existing.collected['_awaitingConfirm'] === 'true') {
      const lang = (existing.collected['_language'] as 'ar' | 'dk' | 'en') || 'en';
      existing.collected = { _language: lang };
      existing.chatHistory = [];
      existing.stage = 'booking';
      delete existing.collected['_awaitingConfirm'];
      touch(existing);
      await sendWA(phone, RESET_MSG[lang]);
    } else {
      const lang = existing?.collected?.['_language'] || detectLanguage(msg);
      await sendWA(phone, lang === 'ar' ? 'لا يوجد حجز بانتظار التأكيد.' : lang === 'dk' ? 'Ingen booking venter på bekræftelse.' : 'No booking awaiting confirmation.');
    }
    return;
  }

  // ---- Edit ride: handle which address field to change ----
  if (cancelLower === 'edit_pickup' || cancelLower === 'edit_dropoff' || cancelLower === 'edit_stop') {
    const existing = sessions.get(phone);
    if (existing?.collected?.['_editRideId'] && existing.collected['_awaitingEditChoice'] === 'true') {
      delete existing.collected['_awaitingEditChoice'];
      existing.collected['_editField'] = cancelLower === 'edit_pickup' ? 'pickup' : cancelLower === 'edit_dropoff' ? 'dropoff' : 'stop';
      touch(existing);
      const lang = (existing.collected['_language'] as 'ar' | 'dk' | 'en') || 'en';
      const prompt = lang === 'ar'
        ? 'الرجاء كتابة العنوان الجديد كاملاً مع الرمز البريدي والمدينة.'
        : lang === 'dk'
          ? 'Skriv venligst den nye fulde adresse med postnummer og by.'
          : 'Please write the new full address with postal code and city.';
      await sendWA(phone, prompt);
      return;
    }
  }

  // ---- Edit ride: receive new address input ----
  {
    const existing = sessions.get(phone);
    if (existing?.collected?.['_editRideId'] && existing.collected['_editField'] && !existing.collected['_awaitingConfirm']) {
      const handled = await handleEditAddressInput(phone, msg);
      if (handled) return;
    }
  }

  // ---- Rebook a past ride ----
  const rebookMatch = msg.match(/(?:rebook|إعادة حجز|اعادة حجز|اعد حجز|إعادة رحلة|اعادة رحلة|re-?book)\s*#?\s*(\d+)/i);
  if (rebookMatch) {
    const rideId = parseInt(rebookMatch[1]);
    await handleRebook(phone, rideId);
    return;
  }

  // ---- Get or init session ----
  let s = sessions.get(phone);
  if (!s) {
    const u = await findUserByPhone(phone);
    if (u) {
      if (!u.emailVerified) {
        const lang = detectLanguage(msg);
        s = { phone, stage: 'verify_email', userId: u.id, userExists: true, firstName: u.firstName, collected: { _language: lang }, chatHistory: [], ts: Date.now() };
        touch(s);
        await sendWA(phone, MSG.verifyPrompt[lang](u.firstName, u.email));
        return;
      }
      s = { phone, stage: 'menu', userId: u.id, userExists: true, firstName: u.firstName, collected: {}, chatHistory: [], ts: Date.now() };
    } else {
      s = { phone, stage: 'registration', userId: null, userExists: false, firstName: '', collected: {}, chatHistory: [], ts: Date.now() };
      touch(s);
      await sendWA(phone, 'Welcome to 944 Trafik! 🚕\n\nLet\'s start with registration. What is your first name?');
    }
    touch(s);
  }

  // ---- Email verification (before AI processing) ----
  if (s.stage === 'verify_email') {
    const code = msg.replace(/\s/g, '');

    // Handle resend request
    if (msg.toLowerCase() === 'resend' || msg === 'إعادة' || msg === 'اعادة') {
      const user = await prisma.user.findUnique({
        where: { id: s.userId! },
        select: { email: true, firstName: true },
      });
      if (!user) {
        await sendWA(phone, 'خطأ. أرسل /reset للبدء من جديد.');
        return;
      }

      const newCode = String(Math.floor(100000 + Math.random() * 900000));
      await prisma.user.update({
        where: { id: s.userId! },
        data: { emailVerifyCode: newCode, emailVerifyExpires: new Date(Date.now() + 36e5) },
      });

      await import('@/lib/email').then(({ sendEmail }) =>
        sendEmail(user.email, 'Verify your email - 944 Trafik',
          `<p>Your verification code: <b>${newCode}</b>. It expires in 1 hour.</p>`).catch(() => {})
      );

      const lang = s.collected['_language'] || detectLanguage(msg);
      await sendWA(phone, MSG.codeResent[lang](user.email));
      return;
    }
    if (/^\d{6}$/.test(code)) {
      const user = await prisma.user.findUnique({
        where: { id: s.userId! },
        select: { emailVerifyCode: true, emailVerifyExpires: true, email: true },
      });

      if (!user) {
        await sendWA(phone, 'خطأ. أرسل /reset للبدء من جديد.');
        return;
      }

      if (user.emailVerifyCode === code) {
        if (user.emailVerifyExpires && new Date(user.emailVerifyExpires) < new Date()) {
          const lang = s.collected['_language'] || detectLanguage(msg);
          await sendWA(phone, MSG.codeExpired[lang]);
          return;
        }

        await prisma.user.update({
          where: { id: s.userId! },
          data: { emailVerified: true, emailVerifyCode: null, emailVerifyExpires: null },
        });

        s.stage = 'menu'; s.userExists = true;
        touch(s);

        const lang = s.collected['_language'] || 'en';
        await sendWA(phone, MSG.emailVerified[lang](s.firstName));
        return;
      } else {
        const lang = s.collected['_language'] || detectLanguage(msg);
        await sendWA(phone, MSG.wrongCode[lang]);
        return;
      }
    }

    // Not a 6-digit code - check if user wants to skip/reset
    if (msg === '/reset' || msg === '/start') {
      sessions.delete(phone);
      s = { phone, stage: 'menu', userId: s.userId, userExists: true, firstName: s.firstName, collected: {}, chatHistory: [], ts: Date.now() };
      touch(s);
      await sendWA(phone, `Hello ${s.firstName}! How can I help you?`);
      return;
    }

    // Ask for code again with hint
    const lang = s.collected['_language'] || detectLanguage(msg);
    await sendWA(phone, MSG.askCode[lang]);
    return;
  }

  // ---- AI Processing ----
  let ai: AIResponse;
  try {
    ai = await processMessage({
      userMessage: msg, userExists: s.userExists, stage: s.stage,
      collected: s.collected, chatHistory: s.chatHistory,
    });
  } catch {
    await sendWA(phone, 'Sorry, an error occurred. Send /reset to start over.');
    return;
  }

  // Merge collected data
  if (ai.collected) {
    for (const [k, v] of Object.entries(ai.collected)) {
      if (v) s.collected[k] = String(v);
    }
  }

  // Enforce stop address step: if dropoff is collected but stop not asked, remove next fields to force AI to ask
  if (s.collected.dropoffAddress && !s.collected.stopAddress && s.collected.pickupTime && !s.collected.vehicleTypePreference && !s.collected.paymentPreference) {
    delete s.collected.pickupTime;
    delete s.collected.pickupTimeISO;
  }

  // Update history
  s.chatHistory.push({ role: 'user', content: msg }, { role: 'assistant', content: ai.reply });
  if (s.chatHistory.length > 20) s.chatHistory = s.chatHistory.slice(-20);

  // Language tracking - detect and store
  const detectedLang = ai.language || 'en';
  s.collected['_language'] = detectedLang;

  // ---- Route by AI action ----
  switch (ai.action) {
    // ===== REGISTRATION CONFIRM =====
    case 'confirm_registration': {
      // Resolve full name: AI sends fullName OR firstName+lastName
      let f = s.collected.firstName || '', l = s.collected.lastName || '';
      const fullName = s.collected.fullName || '';
      if (!f && !l && fullName) {
        const parts = fullName.trim().split(/\s+/);
        f = parts[0] || '';
        l = parts.slice(1).join(' ') || '';
        s.collected.firstName = f;
        s.collected.lastName = l;
      }

      const e = s.collected.email || '';
      const a = s.collected.address || '';
      const pwd = s.collected.password || '';

      const missing: string[] = [];
      if (!f) missing.push('fullName');
      else if (validateName(f)) missing.push('name_invalid');
      if (!l) missing.push('lastName');
      else if (validateName(l)) missing.push('name_invalid');
      if (!e) missing.push('email');
      else if (!EMAIL_REGEX.test(e.trim())) missing.push('email_invalid');
      if (!a) missing.push('address');
      if (!pwd) missing.push('password');
      else if (pwd.length < 8) missing.push('password_short');

      if (missing.length) {
        const msgs: Record<string, Record<string, string>> = {
          ar: { fullName: 'الاسم الكامل', lastName: 'الاسم الأخير', email: 'البريد الإلكتروني', address: 'العنوان (مع الرمز البريدي والمدينة)', password: 'كلمة المرور', name_invalid: 'الاسم بأحرف غير صالحة (لاتيني فقط)', email_invalid: 'صيغة البريد غير صحيحة', password_short: 'كلمة المرور قصيرة (8 أحرف على الأقل)' },
          dk: { fullName: 'Fulde navn', lastName: 'Efternavn', email: 'Email', address: 'Adresse (postnr + by)', password: 'Adgangskode', name_invalid: 'Ugyldigt navn (kun latinske bogstaver)', email_invalid: 'Ugyldig email', password_short: 'Adgangskode for kort (min 8 tegn)' },
          en: { fullName: 'Full name', lastName: 'Last name', email: 'Email', address: 'Address (postcode + city)', password: 'Password', name_invalid: 'Invalid name (Latin letters only)', email_invalid: 'Invalid email', password_short: 'Password too short (min 8 chars)' },
        };
        const lang = detectedLang === 'ar' ? 'ar' : detectedLang === 'dk' ? 'dk' : 'en';
        const names = missing.map(m => msgs[lang][m] || m);
        await sendWA(phone, lang === 'ar' ? `ينقصني:\n- ${names.join('\n- ')}` : `Missing:\n- ${names.join('\n- ')}`);
        touch(s); return;
      }

      const dup = await prisma.user.findUnique({ where: { email: e.trim() } });
      if (dup) {
        const lang = detectedLang === 'ar' ? 'ar' : detectedLang === 'dk' ? 'dk' : 'en';
        const dupMsg: Record<string, string> = {
          ar: 'هذا البريد مسجل مسبقاً. استخدم بريداً آخر.',
          dk: 'Denne email er allerede registreret. Brug en anden.',
          en: 'This email is already registered. Please use a different email.',
        };
        await sendWA(phone, dupMsg[lang]);
        touch(s); return;
      }

      const reg = await doRegister(e, f, l, phone, a, pwd);
      if (!reg.ok) { await sendWA(phone, reg.error || 'Registration failed. Please try again.'); touch(s); return; }

      s.userId = reg.uid!; s.userExists = true; s.firstName = f;
      s.stage = 'verify_email'; touch(s);

      const lang = detectedLang;
      await sendWA(phone, MSG.regSuccess[lang](e));
      return;
    }

    // ===== EMAIL VERIFICATION =====
    case 'verify_email': {
      // Actually this case is handled by stage, not action
      // The AI might try to confirm_registration when user enters code
      // But the code entry is handled below
      break;
    }

    // ===== BOOKING: Payment Choice =====
    case 'ask_payment': {
      s.stage = 'payment';
      touch(s);

      const payButtons: { id: string; title: string }[] = detectedLang === 'ar'
        ? [{ id: 'meter', title: 'عداد (كاش)' }, { id: 'fixed', title: 'بطاقة (أونلاين)' }]
        : detectedLang === 'dk'
          ? [{ id: 'meter', title: 'Taxameter (Kontant)' }, { id: 'fixed', title: 'Kort (Online)' }]
          : [{ id: 'meter', title: 'Meter (Cash)' }, { id: 'fixed', title: 'Card (Online)' }];

      const ft = detectedLang === 'ar' ? 'اختر طريقة الدفع' : detectedLang === 'dk' ? 'Vælg betalingsmetode' : 'Choose payment method';
      await sendWAButtons(phone, ai.reply, payButtons, ft);
      return;
    }

    // ===== BOOKING: Show Summary =====
    case 'show_summary': {
      s.stage = 'payment';
      s.collected['_awaitingConfirm'] = 'true';
      touch(s);

      console.log('[WA summary] collected:', JSON.stringify(s.collected));
      const estimate = await computePriceEstimate(s);
      let replyText = ai.reply;
      if (estimate) {
        const priceLine = detectedLang === 'ar'
          ? `\n\n🚕 ${estimate.vtName}\n💰 السعر التقديري: ${estimate.price} DKK (المسافة: ~${Math.round(estimate.distance * 10) / 10} كم)`
          : detectedLang === 'dk'
            ? `\n\n🚕 ${estimate.vtName}\n💰 Estimeret pris: ${estimate.price} DKK (afstand: ~${Math.round(estimate.distance * 10) / 10} km)`
            : `\n\n🚕 ${estimate.vtName}\n💰 Estimated price: ${estimate.price} DKK (distance: ~${Math.round(estimate.distance * 10) / 10} km)`;
        replyText += priceLine;
        s.collected['_estimatedPrice'] = String(estimate.price);
      } else {
        replyText += detectedLang === 'ar'
          ? '\n\n⚠️ تعذر حساب السعر التقديري.'
          : detectedLang === 'dk'
            ? '\n\n⚠️ Kunne ikke beregne estimeret pris.'
            : '\n\n⚠️ Could not calculate estimated price.';
      }

      const summaryButtons: { id: string; title: string }[] = detectedLang === 'ar'
        ? [{ id: 'confirm', title: '✅ تأكيد الحجز' }, { id: 'discard', title: '❌ إلغاء' }]
        : detectedLang === 'dk'
          ? [{ id: 'confirm', title: '✅ Bekræft' }, { id: 'discard', title: '❌ Annuller' }]
          : [{ id: 'confirm', title: '✅ Confirm' }, { id: 'discard', title: '❌ Discard' }];

      await sendWAButtons(phone, replyText, summaryButtons);
      return;
    }

    // ===== BOOKING CONFIRM =====
    case 'confirm_booking': {
      if (!s.collected.pickupAddress || !s.collected.dropoffAddress) {
        s.stage = 'booking';
        await sendWA(phone, ai.reply); touch(s); return;
      }
      await handleConfirmBooking(s, phone, detectedLang);
      return;
    }

    // ===== MENU / HELP =====
    case 'show_menu':
      s.collected = { _language: detectedLang };
      s.chatHistory = [];
      s.stage = 'booking';
      touch(s);
      await sendWA(phone, RESET_MSG[detectedLang]);
      return;

    case 'show_help':
      await sendWA(phone, RESET_MSG[detectedLang]); touch(s); return;

    // ===== CONTINUE =====
    default:
      if (s.stage === 'menu' && s.collected.pickupAddress) s.stage = 'booking';
      await sendWA(phone, ai.reply); touch(s);
  }
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  if (sp.get('hub.mode') === 'subscribe' && sp.get('hub.verify_token') === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(sp.get('hub.challenge'), { status: 200 });
  }
  return new NextResponse('Forbidden', { status: 403 });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (body.object !== 'whatsapp_business_account') {
      return NextResponse.json({ status: 'ok' });
    }

    const tasks: Promise<void>[] = [];

    for (const entry of (body.entry || [])) {
      for (const change of (entry.changes || [])) {
        if (change.field !== 'messages') continue;
        const value = change.value || {};
        const messages = value.messages || [];
        const contacts = value.contacts || [];

        for (let i = 0; i < messages.length; i++) {
          const msg = messages[i];
          const contact = contacts[i] || contacts[0] || {};
          const phone = contact.wa_id || msg.from;
          if (!phone) continue;

          let text = '';
          if (msg.type === 'text') text = msg.text?.body || '';
          else if (msg.type === 'interactive') {
            const ix = msg.interactive || {};
            // button_reply returns id; list_reply returns id too
            const br = ix.button_reply || ix.list_reply || {};
            text = br.id || '';
            // If id is empty but title exists, use title as fallback
            if (!text && br.title) text = br.title;
          }

          if (!text) { tasks.push(sendWA(phone, 'Please send a text message.')); continue; }

          tasks.push(processInBackground(phone, text, contact.profile?.name || ''));
        }
      }
    }

    // Respond to Meta immediately
    const response = NextResponse.json({ status: 'ok' });
    Promise.allSettled(tasks).catch(() => {});
    return response;

  } catch (error) {
    console.error('[WhatsApp] Fatal:', error);
    return NextResponse.json({ status: 'error' }, { status: 500 });
  }
}