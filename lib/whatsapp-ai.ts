import OpenAI from 'openai';

const MAX_USER_MSG_LENGTH = 1500;
const MAX_COLLECTED_FIELD_LENGTH = 200;

function sanitizeFieldForPrompt(value: string): string {
  return value
    .replace(/[\r\n]+/g, ' ')
    .replace(/\\n/g, ' ')
    .replace(/[\p{Cc}\p{Cs}\p{Cf}]/gu, '')
    .substring(0, MAX_COLLECTED_FIELD_LENGTH)
    .trim();
}

let openai: OpenAI | null = null;

function getClient(): OpenAI {
  if (!openai) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || '',
      maxRetries: 1,
      timeout: 8000,
    });
  }
  return openai;
}

// ========================
// Types
// ========================

export interface AIResponse {
  action: 'ask_question' | 'ask_payment' | 'show_summary' | 'confirm_booking' | 'confirm_registration' | 'show_menu' | 'show_help';
  reply: string;
  language: 'ar' | 'dk' | 'en';
  collected: {
    firstName?: string;
    lastName?: string;
    fullName?: string;
    email?: string;
    address?: string;
    pickupAddress?: string;
    dropoffAddress?: string;
    stopAddress?: string;
    pickupTime?: string;
    pickupTimeISO?: string;
    vehicleTypePreference?: string;
    vehicleTypeId?: number;
    paymentPreference?: string;
  };
  missingFields: string[];
  contextNote?: string;
}

export interface ConversationTurn {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// ========================
// System Prompt (optimized for speed & strict language)
// ========================

function buildSystemPrompt(
  userExists: boolean,
  currentStage: 'greeting' | 'registration' | 'verify_email' | 'booking' | 'payment' | 'menu',
  alreadyCollected: Record<string, string>
): string {
  const c = alreadyCollected;
  const sf = sanitizeFieldForPrompt;
  const collectedStr = [
    c.fullName ? `name=${sf(c.fullName)}` : '',
    c.firstName ? `firstName=${sf(c.firstName)}` : '',
    c.lastName ? `lastName=${sf(c.lastName)}` : '',
    c.email ? `email=${sf(c.email)}` : '',
    c.address ? `address=${sf(c.address)}` : '',
    c.pickupAddress ? `pickup=${sf(c.pickupAddress)}` : '',
    c.dropoffAddress ? `dropoff=${sf(c.dropoffAddress)}` : '',
    c.stopAddress ? `stop=${sf(c.stopAddress)}` : '',
    c.pickupTime ? `time=${sf(c.pickupTime)}` : '',
    c.vehicleTypePreference ? `vehicle=${sf(c.vehicleTypePreference)}` : '',
    c._language ? `lang=${sf(c._language)}` : '',
  ].filter(Boolean).join(' | ');

  const regFlow = !userExists
    ? `🚫 NEW USER — REGISTRATION IS MANDATORY. You MUST collect registration data BEFORE processing any booking. Ignore booking-related fields until registration is complete. Collect in this exact order: 1) full name (firstName+lastName together, ask once, Latin only) → split into firstName & lastName. 2) email. 3) address with postal code and city. When all 3 collected → action="confirm_registration". Do NOT ask about pickup, dropoff, time, vehicle, or payment until registration is confirmed.`
    : '';

  return `944 Trafik taxi (DK). Stage=${currentStage}. ${userExists ? 'Registered' : 'NEW'}. Data: ${collectedStr || 'none'}
${regFlow}
${userExists ? `Vehicles (show user-friendly names, NEVER raw keys):
- "Standard Car (4 pax)" — limited luggage
- "Large Car (6-7 pax)" — good for groups/luggage
- "Van (8 pax)" — best for lots of luggage
- "Luxury Car (4 pax)" — premium
Payment: "meter" = cash/taxameter. "fixed" = card/Stripe prepayment.

═══ PRIMARY RULE: EXTRACT ALL FIELDS FROM EVERY MESSAGE ═══
BEFORE you do anything else, scan the user's message and extract EVERY recognizable field:
• pickupAddress: the FIRST location after "fra"/"from"/"من". This is always the pickup.
• dropoffAddress: the FINAL destination. If there are 3 locations (fra A til B bagefter/derefter/så til C), the LAST one (C) is the dropoff. If only 2 locations (fra A til B), B is the dropoff.
• stopAddress: the MIDDLE location in a 3-location sequence. If user writes "fra X til Y bagefter til Z" → put Y in stopAddress and Z in dropoffAddress. DO NOT swap them.
• pickupTime: "nu"/"now"/"الآن"→set pickupTime="now". For future dates: set pickupTime to human-readable (e.g. "tomorrow 08:00") AND compute pickupTimeISO as ISO 8601 datetime in Europe/Copenhagen timezone.
  IMPORTANT DATE RULES:
  - Today is ${new Date().toISOString().split('T')[0]}. Current time: ${new Date().toLocaleTimeString('en-GB', { timeZone: 'Europe/Copenhagen', hour: '2-digit', minute: '2-digit' })}.
  - "tomorrow"/"imorgen"/"بكرا"/"غداً" → next day same time, or use specified time
  - "day after tomorrow"/"overmorgen"/"بعد بكرا" → day+2
  - Day names: find NEXT occurrence of that day (if today, use next week)
  - "next Monday"/"næste mandag"/"الاثنين القادم" → next week's Monday
  - "on July 25"/"den 25. juli"/"٢٥ يوليو" → specific date
  - "om en time"/"in 1 hour"/"بعد ساعة" → add 1 hour to now
  - For pickupTimeISO: compute the FULL ISO datetime string like "2026-07-21T08:00:00" using Europe/Copenhagen timezone
  - If no time specified with date, default to current hour rounded up
• vehicleTypePreference: any vehicle mentioned
• paymentPreference: any payment mentioned
• stopAddress: any stop/waypoint mentioned
ONLY after extracting everything, check the checklist below.

═══ EXTRACTION PATTERNS ═══
DANISH:
  "fra X til Y" → pickupAddress=X, dropoffAddress=Y
  "fra X til Y og derefter/bagefter/så til Z" → pickupAddress=X, stopAddress=Y, dropoffAddress=Z
  "fra X til Y via Z" → pickupAddress=X, stopAddress=Z, dropoffAddress=Y
  "fra X til Y, bagefter/derefter/så/og så til Z" → pickupAddress=X, stopAddress=Y, dropoffAddress=Z
  "med stop/stopover ved/i/på X" → stopAddress=X
  "jeg har brug for en taxa nu" / "nu" / "med det samme" → pickupTime="now"
  "imorgen" / "i morgen" → pickupTime="tomorrow TIME", compute pickupTimeISO
  "overmorgen" → pickupTime="day after tomorrow TIME"
  "på mandag/tirsdag/onsdag/torsdag/fredag/lørdag/søndag" → compute next occurrence
  "kl. 8" / "klokken 15" / "kl 10:30" → extract time
  "jeg betaler med taxameter" / "kontant" / "kash" → paymentPreference="meter"
  "jeg betaler med kort" / "dankort" → paymentPreference="fixed"
  "jeg betaler i bilen" / "jeg betaler i taxaen" → paymentPreference="meter"
  "personbil" / "almindelig bil" / "standard" → vehicleTypePreference="SEDAN5"
  "stor bil" / "6-7 personer" → vehicleTypePreference="SEVEN_NO_BAG"
  "van" / "varevogn" / "8 personer" → vehicleTypePreference="VAN"
  "luksus" / "limousine" / "limo" → vehicleTypePreference="LIMO"
ENGLISH:
  "from X to Y" → pickupAddress=X, dropoffAddress=Y
  "from X to Y then/after/and then to Z" → pickupAddress=X, stopAddress=Y, dropoffAddress=Z
  "from X to Y via Z" → pickupAddress=X, stopAddress=Z, dropoffAddress=Y
  "with stop/stopover at X" → stopAddress=X
  "cash"/"meter"/"in the car"→paymentPreference="meter", "card"/"online"→paymentPreference="fixed"
  "tomorrow" → pickupTime="tomorrow TIME", compute pickupTimeISO
  "on Monday/Tuesday/Wednesday/Thursday/Friday/Saturday/Sunday" → compute next occurrence
  "at 8am"/"at 3pm"/"at 10:30" → extract time
  "standard"/"normal"/"4 pax"→SEDAN5, "large"/"6-7"→SEVEN_NO_BAG, "van"/"8"→VAN, "luxury"/"limo"→LIMO
ARABIC:
  "من X إلى Y" → pickupAddress=X, dropoffAddress=Y
  "من X إلى Y ثم/وبعدين/وبعدها إلى Z" → pickupAddress=X, stopAddress=Y, dropoffAddress=Z
  "من X إلى Y عبر Z" → pickupAddress=X, stopAddress=Z, dropoffAddress=Y
  "مع توقف/محطة في X" → stopAddress=X
  "كاش"/"نقداً"/"عداد"/"بالسيارة"→paymentPreference="meter", "بطاقة"/"فيزا"/"أونلاين"→paymentPreference="fixed"
  "بكرا"/"غداً" → pickupTime="tomorrow TIME", compute pickupTimeISO
  "بعد بكرا"/"بعد غد" → pickupTime="day after tomorrow TIME"
  "السبت/الأحد/الاثنين/الثلاثاء/الأربعاء/الخميس/الجمعة" → compute next occurrence
  "الساعة 8"/"الساعة 3"/"الساعة 10:30" → extract time
  "سيارة"/"عادية"/"صغيرة"/"4"→SEDAN5, "كبيرة"/"6-7"/"فان"/"8"→VAN, "لكزس"/"لوكس"/"فاخرة"→LIMO

EXAMPLE — User sends: "Jeg vil have en taxa fra Parkalle 21, 3600 Frederikssund til Frederikssund station, personbil, nu, kontant"
  → extracted: pickupAddress="Parkalle 21, 3600 Frederikssund", dropoffAddress="Frederikssund station", pickupTime="now", vehicleTypePreference="SEDAN5", paymentPreference="meter"
  → ALL collected → action="show_summary"

EXAMPLE — User sends: "Fra Maglehøjparken 137, Frederikssund til Tvedsagervej 6, Harløse bagefter til København lufthavn, nu, personbil"
  → 3 locations! First location is pickup, middle (after "til") is stop, last (after "bagefter til") is target.
  → extracted: pickupAddress="Maglehøjparken 137, Frederikssund", stopAddress="Tvedsagervej 6, Harløse", dropoffAddress="København lufthavn", pickupTime="now", vehicleTypePreference="SEDAN5"
  → IMPORTANT: stopAddress=Tvedsagervej 6, dropoffAddress=København lufthavn. DO NOT swap them.

═══ BOOKING CHECKLIST (only for what's STILL MISSING after extraction) ═══
Ask ONE question per reply. Never ask about something the user already provided.
1. pickupAddress ← required. Accept ANY address format: landmarks, stations, hospitals, postcodes, street+number+city. Just extract what the user provided.
2. dropoffAddress ← required. Same validation.
3. stopAddress ← ALWAYS ask. Do NOT skip this step. Ask "Any stop along the way?" If user says no/skip/nej/لا → set stopAddress="none".
4. pickupTime ← required. Accept "now"/"nu"/"الآن" or specific date/time.
5. vehicleTypePreference ← required. Show the 4 options as numbered list. Use action="ask_question".
6. paymentPreference ← required. Use action="ask_payment".

═══ BOOKING FINAL STEP ═══
When ALL 6 fields are collected (including stopAddress, which can be "none") → action="show_summary"` : `═══ REGISTRATION ONLY ═══
You are talking to a NEW user. You MUST ONLY collect registration data.
IGNORE any booking-related input (addresses, times, vehicles, payments).
DO NOT set pickupAddress, dropoffAddress, pickupTime, vehicleTypePreference, or paymentPreference fields.

Collect in this exact order — ONE question per reply:
1. fullName (firstName+lastName together, ask once, Latin letters only) → split into firstName & lastName
2. email (valid email format)
3. address (with postal code and city)

When all 3 collected → action="confirm_registration"

═══ REGISTRATION EXTRACTION ═══
Only extract these fields from messages:
• fullName from text mentioning a name
• email from text containing @
• address from text containing a street/city/postal code → store in "address" field ONLY, NEVER in pickupAddress
If the user sends a booking request, reply: complete registration first and ask for the next missing field.`}

RULES:
- Detect user's language. Reply in THAT language. Report in "language" field.
- ${userExists ? 'User is registered. Booking flow only. NEVER ask for registration data (name, email, address).' : '⚠️ NEW USER — REGISTRATION ONLY. Collect fullName→email→address. NEVER process booking. If user tries to book, redirect to registration. A password setup link will be emailed after registration.'}
- If the assistant's last message ended with a location question, the user's reply IS the address. Set it directly.
- If user asks about non-taxi topics: politely decline, action="show_menu".
- Be concise. 1-2 sentences max.

 JSON: {"action":"ask_question"|"ask_payment"|"show_summary"|"confirm_booking"|"confirm_registration"|"show_menu"|"show_help","reply":"...","language":"ar"|"dk"|"en","collected":{"fullName":null,"firstName":null,"lastName":null,"email":null,"address":null,"pickupAddress":null,"dropoffAddress":null,"stopAddress":null,"pickupTime":null,"pickupTimeISO":null,"vehicleTypePreference":null,"vehicleTypeId":null,"paymentPreference":null},"missingFields":[],"contextNote":null}`;
}

// ========================
// Build conversation history
// ========================

function buildHistory(
  userExists: boolean,
  stage: 'greeting' | 'registration' | 'verify_email' | 'booking' | 'payment' | 'menu',
  collected: Record<string, string>,
  recentMessages: { role: 'user' | 'assistant'; content: string }[]
): ConversationTurn[] {
  const history: ConversationTurn[] = [
    { role: 'system', content: buildSystemPrompt(userExists, stage, collected) },
  ];

  const recent = recentMessages.slice(-6);
  for (const msg of recent) {
    history.push({ role: msg.role, content: msg.content });
  }

  return history;
}

// ========================
// Main AI call
// ========================

export async function processMessage(params: {
  userMessage: string;
  userExists: boolean;
  stage: 'greeting' | 'registration' | 'verify_email' | 'booking' | 'payment' | 'menu';
  collected: Record<string, string>;
  chatHistory: { role: 'user' | 'assistant'; content: string }[];
}): Promise<AIResponse> {
  const { userMessage, userExists, stage, collected, chatHistory } = params;

  const safeMessage = sanitizeFieldForPrompt(userMessage).substring(0, MAX_USER_MSG_LENGTH);

  const messages = buildHistory(userExists, stage, collected, chatHistory);
  messages.push({ role: 'user', content: safeMessage });

  try {
    const client = getClient();
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: messages as any,
      temperature: 0.2,
      max_tokens: 600,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content || '{}';

    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
      else throw new Error('Invalid JSON from AI');
    }

    return normalizeResponse(parsed);
  } catch (error: any) {
    console.error('[WA AI]', error);
    return {
      action: 'ask_question',
      reply: 'Sorry, an error occurred. Please try again or send /reset.',
      language: 'en',
      collected: {},
      missingFields: [],
    };
  }
}

// ========================
// Normalize & validate
// ========================

function normalizeResponse(raw: any): AIResponse {
  const cleanStr = (v: any): string | undefined => {
    if (!v || v === 'null' || v === 'undefined' || v === 'N/A') return undefined;
    return String(v).trim();
  };

  return {
    action: ['ask_question', 'ask_payment', 'show_summary', 'confirm_booking', 'confirm_registration', 'show_menu', 'show_help'].includes(raw.action)
      ? raw.action : 'ask_question',
    reply: raw.reply || 'How can I help you?',
    language: ['ar', 'dk', 'en'].includes(raw.language) ? raw.language : 'en',
    collected: {
      fullName: cleanStr(raw.collected?.fullName),
      firstName: cleanStr(raw.collected?.firstName),
      lastName: cleanStr(raw.collected?.lastName),
      email: cleanStr(raw.collected?.email),
      address: cleanStr(raw.collected?.address),
      pickupAddress: cleanStr(raw.collected?.pickupAddress) || cleanStr(raw.collected?.pickup),
      dropoffAddress: cleanStr(raw.collected?.dropoffAddress) || cleanStr(raw.collected?.dropoff),
      stopAddress: cleanStr(raw.collected?.stopAddress) || cleanStr(raw.collected?.stop),
      pickupTime: cleanStr(raw.collected?.pickupTime),
      pickupTimeISO: cleanStr(raw.collected?.pickupTimeISO),
      vehicleTypePreference: cleanStr(raw.collected?.vehicleTypePreference),
      vehicleTypeId: typeof raw.collected?.vehicleTypeId === 'number' ? raw.collected.vehicleTypeId : undefined,
      paymentPreference: cleanStr(raw.collected?.paymentPreference),
    },
    missingFields: Array.isArray(raw.missingFields) ? raw.missingFields : [],
    contextNote: cleanStr(raw.contextNote),
  };
}