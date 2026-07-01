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

MANDATORY CHECKLIST — find the FIRST missing field below and ask for it. ONE question per reply.
BUT if the user sends MULTIPLE details in one message, extract ALL of them FIRST, then decide what's still missing.
1. pickupAddress — ask: "Where should we pick you up?" 
   IF user provides an address, validate it looks complete: must include a street OR landmark name. 
   If address is too vague (just a city, just a postcode, or just "home" without a saved address in Data), ask them to be more specific: "Please include the street name with number, postcode, and city."
2. dropoffAddress — ask: "Where are you going?"
   Same validation as pickupAddress.
3. stopAddress (OPTIONAL) — ask: "Do you need a stop along the way?" If user says no/skip/لا/no thanks/nej/لا يوجد → set stopAddress="none" and proceed.
   ALWAYS ask this question after collecting dropoffAddress (unless user already mentioned a stop or said "no stops" in their message).
   This is a REQUIRED step in the flow — do not skip it.
4. pickupTime — ask: "When do you need the ride?" (accept "now"/"later"+datetime)
   EXTRACT time from user message carefully. Parse these patterns into pickupTime (human-readable) AND pickupTimeISO (ISO 8601 string):
   - "now" / "nu" / "الآن" → pickupTime="now", pickupTimeISO=null
   - "tomorrow 3pm" / "i morgen kl 15" / "غداً الساعة 3" → calculate correct date
   - "Monday 10:00" / "mandag 10:00" / "الاثنين 10:00" → next occurrence
   - "imorgen kl.12.00" → pickupTime="i morgen kl. 12.00", pickupTimeISO="2026-06-29T10:00:00Z"
   - "kl. 14:30" or "14:30" (time only, no date) → assume today if time is in the future, otherwise tomorrow
   CURRENT DATE: ${new Date().toISOString().slice(0, 10)}. Use this to calculate relative dates.
   IF user provides a date/time → set pickupTime and pickupTimeISO.
5. vehicleTypePreference — SHOW the 4 options as a numbered list. Accept names/numbers/descriptions.
   Use action="ask_question". DO NOT show price, DO NOT show summary buttons, DO NOT ask for confirmation.
   This is ONLY a vehicle selection question — not the final summary.
6. paymentPreference — use action="ask_payment". List "meter (cash)" or "fixed (card)".
   DO NOT show price or summary buttons. This is ONLY a payment question.
7. ALL required collected (pickupAddress + dropoffAddress + pickupTime + vehicleTypePreference + paymentPreference) → action="show_summary" (system adds price + confirm/discard buttons)

CRITICAL:
- LANGUAGE: Detect user's language. Reply in THAT language. Report in "language" field.
- ${!userExists ? 'Registration: collect fullName→email→address→password in order. When done → confirm_registration.' : 'User is registered. ONLY bookings via CHECKLIST. NEVER registration data.'}
- BEFORE asking any question, check if the user's message already contains the answer. Extract ALL recognizable fields from every message.
- CRITICAL: If the previous assistant message ends with "Where should we pick you up?" or similar location question, the user's reply IS the pickup address. Set pickupAddress=userMessage immediately. Do NOT repeat the same question.
- IMPORTANT: If user's message contains "fra X til Y" or "from X to Y" or "X til Y", ALWAYS extract pickupAddress=X and dropoffAddress=Y. Do NOT ask "where to go" if already provided.
- ONE-MESSAGE BOOKINGS: Extract EVERYTHING from patterns like "fra X til Y, vehicle, time, payment"
  • "fra X til Y" → pickupAddress=X, dropoffAddress=Y
  • "from X to Y" → pickupAddress=X, dropoffAddress=Y
  • "من X إلى Y" → pickupAddress=X, dropoffAddress=Y
- Extract vehicle from keywords: "standard/normal/almindelig/personbil/سيارة/عادية/4pax"→SEDAN5, "large/كبيرة/6-7pax"→SEVEN_NO_BAG, "van/فان/8pax"→VAN, "luxury/limo/لوكس"→LIMO
- Extract payment: "cash/كاش/kontant/meter"→meter, "card/بطاقة/kort/fixed"→fixed
- If user asks about anything unrelated to taxi booking: politely reply you only help with taxi bookings. Use action="show_menu".
- If user asks to book 2 cars, multiple vehicles, or more than one taxi: politely reply that this feature is not available yet but is being developed and will be activated soon. Use action="show_menu".
- Be concise. 1-2 sentences.

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