import OpenAI from 'openai';

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
    password?: string;
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
  const collectedStr = [
    c.fullName ? `name=${c.fullName}` : '',
    c.firstName ? `firstName=${c.firstName}` : '',
    c.lastName ? `lastName=${c.lastName}` : '',
    c.email ? `email=${c.email}` : '',
    c.address ? `address=${c.address}` : '',
    c.password ? `password=***` : '',
    c.pickupAddress ? `pickup=${c.pickupAddress}` : '',
    c.dropoffAddress ? `dropoff=${c.dropoffAddress}` : '',
    c.stopAddress ? `stop=${c.stopAddress}` : '',
    c.pickupTime ? `time=${c.pickupTime}` : '',
    c.vehicleTypePreference ? `vehicle=${c.vehicleTypePreference}` : '',
    c._language ? `lang=${c._language}` : '',
  ].filter(Boolean).join(' | ');

  const regFlow = !userExists
    ? `New user. Collect in order: 1) full name (firstName+lastName together, ask once, Latin only) → split into firstName & lastName. 2) email. 3) address with postal code and city. 4) password (min 8 chars, user chooses). When all 4 collected → confirm_registration.`
    : '';

  return `944 Trafik taxi (DK). Stage=${currentStage}. ${userExists ? 'Registered' : 'NEW'}. Data: ${collectedStr || 'none'}
${regFlow}
Vehicles (show user-friendly names, NEVER raw keys):
- "Standard Car (4 pax)" — limited luggage
- "Large Car (6-7 pax)" — good for groups/luggage
- "Van (8 pax)" — best for lots of luggage
- "Luxury Car (4 pax)" — premium
Payment: "meter" = cash/taxameter. "fixed" = card/Stripe prepayment.

═══ PRIMARY RULE: EXTRACT ALL FIELDS FROM EVERY MESSAGE ═══
BEFORE you do anything else, scan the user's message and extract EVERY recognizable field:
• pickupAddress: where to pick up (look for "fra"/"from"/"من"+place, or the place before "til"/"to"/"إلى")
• dropoffAddress: destination (look for "til"/"to"/"إلى"+place)
• pickupTime: "nu"/"now"/"الآن"→set pickupTime="now", or any date/time
• vehicleTypePreference: any vehicle mentioned
• paymentPreference: any payment mentioned
• stopAddress: any stop/waypoint mentioned
ONLY after extracting everything, check the checklist below.

═══ EXTRACTION PATTERNS ═══
DANISH: "fra X til Y" → pickupAddress=X, dropoffAddress=Y
  "jeg har brug for en taxa nu" / "nu" / "med det samme" → pickupTime="now"
  "jeg betaler med taxameter" / "kontant" / "kash" → paymentPreference="meter"
  "jeg betaler med kort" / "dankort" → paymentPreference="fixed"
  "personbil" / "almindelig bil" / "standard" → vehicleTypePreference="SEDAN5"
  "stor bil" / "6-7 personer" → vehicleTypePreference="SEVEN_NO_BAG"
  "van" / "varevogn" / "8 personer" → vehicleTypePreference="VAN"
  "luksus" / "limousine" / "limo" → vehicleTypePreference="LIMO"
ENGLISH: "from X to Y" → pickupAddress=X, dropoffAddress=Y
  "cash"/"meter"→paymentPreference="meter", "card"/"online"→paymentPreference="fixed"
  "standard"/"normal"/"4 pax"→SEDAN5, "large"/"6-7"→SEVEN_NO_BAG, "van"/"8"→VAN, "luxury"/"limo"→LIMO
ARABIC: "من X إلى Y" → pickupAddress=X, dropoffAddress=Y
  "كاش"/"نقداً"/"عداد"→paymentPreference="meter", "بطاقة"/"فيزا"/"أونلاين"→paymentPreference="fixed"
  "سيارة"/"عادية"/"صغيرة"/"4"→SEDAN5, "كبيرة"/"6-7"/"فان"/"8"→VAN, "لكزس"/"لوكس"/"فاخرة"→LIMO

EXAMPLE — User sends: "Jeg vil have en taxa fra Parkalle 21, 3600 Frederikssund til Frederikssund station, personbil, nu, kontant"
  → extracted: pickupAddress="Parkalle 21, 3600 Frederikssund", dropoffAddress="Frederikssund station", pickupTime="now", vehicleTypePreference="SEDAN5", paymentPreference="meter"
  → ALL collected → action="show_summary"

═══ CHECKLIST (only for what's STILL MISSING after extraction) ═══
Ask ONE question per reply. Never ask about something the user already provided.
1. pickupAddress ← required. Must include street/landmark + city. If too vague (just "home"/city/postcode), ask for complete address.
2. dropoffAddress ← required. Same validation.
3. stopAddress ← OPTIONAL. Ask once. If user says no/skip/nej/لا → set stopAddress="none". If user already provided all other fields and didn't mention a stop, proceed directly (don't ask).
4. pickupTime ← required. Accept "now"/"nu"/"الآن" or specific date/time.
5. vehicleTypePreference ← required. Show the 4 options as numbered list. Use action="ask_question".
6. paymentPreference ← required. Use action="ask_payment".

═══ FINAL STEP ═══
When ALL 5 required fields are collected (pickupAddress + dropoffAddress + pickupTime + vehicleTypePreference + paymentPreference) → action="show_summary"

RULES:
- Detect user's language. Reply in THAT language. Report in "language" field.
- ${!userExists ? 'Registration flow: collect fullName→email→address→password in order → confirm_registration.' : 'User is registered. Booking flow only. NEVER ask for registration data.'}
- If the assistant's last message ended with a location question, the user's reply IS the address. Set it directly.
- If user asks about non-taxi topics: politely decline, action="show_menu".
- Be concise. 1-2 sentences max.

JSON: {"action":"ask_question"|"ask_payment"|"show_summary"|"confirm_booking"|"confirm_registration"|"show_menu"|"show_help","reply":"...","language":"ar"|"dk"|"en","collected":{"fullName":null,"firstName":null,"lastName":null,"email":null,"address":null,"password":null,"pickupAddress":null,"dropoffAddress":null,"stopAddress":null,"pickupTime":null,"pickupTimeISO":null,"vehicleTypePreference":null,"vehicleTypeId":null,"paymentPreference":null},"missingFields":[],"contextNote":null}`;
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

  const messages = buildHistory(userExists, stage, collected, chatHistory);
  messages.push({ role: 'user', content: userMessage });

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
      password: cleanStr(raw.collected?.password),
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