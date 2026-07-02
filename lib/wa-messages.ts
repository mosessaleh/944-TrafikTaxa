export function detectLanguage(text: string, sessionLang?: string): 'ar' | 'dk' | 'en' {
  if (sessionLang && ['ar', 'dk', 'en'].includes(sessionLang)) return sessionLang as 'ar' | 'dk' | 'en';

  const arabic = /[\u0600-\u06FF]/.test(text);
  if (arabic) return 'ar';
  const dkLetters = /[æøåÆØÅ]/.test(text);
  if (dkLetters) return 'dk';

  const dkWords = /\b(jeg|du|er|det|ikke|en|og|at|på|til|med|der|for|som|har|kan|vil|skal|være|men|hvad|hvor|hvem|hvordan|hvornår|hvorfor|her|der|nu|også|igen|hej|tak|gerne|bestille|brug|hjælp|bil|taxa|tur|kør|afhent|hent|adresse|køre|fra|herfra)\b/i;
  const dkCount = (text.match(dkWords) || []).length;
  const enWords = /\b(the|you|are|not|and|to|with|for|can|will|help|car|taxi|ride|pick|drop|address|from|here|where|when|what|how|please|thanks|book|drive|need|want|get)\b/i;
  const enCount = (text.match(enWords) || []).length;

  if (dkCount > enCount && dkCount >= 2) return 'dk';
  return 'en';
}

export const MSG = {
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
  minimumFareNote: {
    ar: (minPrice: number) => `⚠️ السعر المحسوب أقل من ${minPrice} كرون، وهو الحد الأدنى للأجرة. سيتم تطبيق الحد الأدنى ${minPrice} DKK.`,
    dk: (minPrice: number) => `⚠️ Den beregnede pris er under ${minPrice} kr., som er minimumsprisen. Minimumsprisen på ${minPrice} DKK vil blive anvendt.`,
    en: (minPrice: number) => `⚠️ The calculated fare is below the ${minPrice} DKK minimum. The minimum fare of ${minPrice} DKK will be applied.`,
  },
};

export const RESET_MSG: Record<string, string> = {
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

Commands: /reset • cancel • rebook 123 • edit 123

Ready? Where should we pick you up?`,
};

export const HELP_MSG: Record<string, string> = {
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

export const GREETING_WORDS: Record<string, string[]> = {
  ar: ['مرحبا', 'هلا', 'السلام عليكم', 'مراحب', 'اهلا', 'أهلا', 'صباح الخير', 'مساء الخير', 'سلام'],
  dk: ['hej', 'hejsa', 'halløj', 'goddag', 'godmorgen', 'godaften', 'davs'],
  en: ['hello', 'hi', 'hey', 'good morning', 'good evening', 'howdy', 'yo', 'sup'],
};

export function isGreeting(text: string): { lang: 'ar' | 'dk' | 'en' } | null {
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
