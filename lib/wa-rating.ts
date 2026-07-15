import { prisma } from '@/lib/db';
import { sendWAText, sendWAButtons } from '@/lib/wa-client';
import { getUserSession, createSession, touchSession } from '@/lib/wa-sessions';
import { logWAError } from '@/lib/wa-logger';
import OpenAI from 'openai';

type Lang = 'ar' | 'dk' | 'en';

function getOpenAI(): OpenAI {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || '',
    maxRetries: 1,
    timeout: 12000,
  });
}

function getLang(phone: string): Lang {
  const s = getUserSession(phone);
  const lang = s?.collected?.['_language'];
  if (lang === 'ar' || lang === 'dk' || lang === 'en') return lang;
  return 'en';
}

const MSG = {
  ratePrompt: {
    ar: '⭐ *قيّم السائق*\n\nكيف كانت تجربتك في الرحلة #RIDE؟\nالرجاء تقييم السائق من 1 إلى 5 نجوم:',
    dk: '⭐ *Bedøm din chauffør*\n\nHvordan var din oplevelse på tur #RIDE?\nBedøm venligst fra 1 til 5 stjerner:',
    en: '⭐ *Rate your driver*\n\nHow was your experience on ride #RIDE?\nPlease rate from 1 to 5 stars:',
  },
  highStarsLabel: {
    ar: 'تقييم إيجابي:',
    dk: 'Positive bedømmelser:',
    en: 'High ratings:',
  },
  thankYou5: {
    ar: '⭐ *شكراً لتقييمك!*\n\nقمت بتقييم الرحلة #RIDE بـ 5/5 نجوم.\nنقدر ملاحظاتك! 🚕',
    dk: '⭐ *Tak for din bedømmelse!*\n\nDu bedømte tur #RIDE med 5/5 stjerner.\nVi sætter pris på din feedback! 🚕',
    en: '⭐ *Thank you for your rating!*\n\nYou rated ride #RIDE with 5/5 stars.\nWe appreciate your feedback! 🚕',
  },
  thankYou4: {
    ar: '⭐ *شكراً لتقييمك!*\n\nقمت بتقييم الرحلة #RIDE بـ 4/5 نجوم.\nنقدر ملاحظاتك! 🚕',
    dk: '⭐ *Tak for din bedømmelse!*\n\nDu bedømte tur #RIDE med 4/5 stjerner.\nVi sætter pris på din feedback! 🚕',
    en: '⭐ *Thank you for your rating!*\n\nYou rated ride #RIDE with 4/5 stars.\nWe appreciate your feedback! 🚕',
  },
  notYourRide: {
    ar: '❌ هذه الرحلة غير مرتبطة بحسابك.',
    dk: '❌ Denne tur er ikke tilknyttet din konto.',
    en: '❌ This ride is not associated with your account.',
  },
  alreadyRated: {
    ar: 'لقد قمت بتقييم هذه الرحلة مسبقاً. شكراً لك!',
    dk: 'Du har allerede bedømt denne tur. Tak!',
    en: 'You have already rated this ride. Thank you!',
  },
  problemPrompt: {
    ar: '⭐ قمت بتقييم RATING/5 نجوم.\n\nنأسف أن تجربتك لم تكن مثالية. 😔\nهل يمكنك إخبارنا بما حدث؟ الرجاء وصف المشكلة باختصار.',
    dk: '⭐ Du bedømte RATING/5 stjerner.\n\nVi er kede af, at din oplevelse ikke var perfekt. 😔\nKan du fortælle os, hvad der gik galt? Beskriv venligst problemet kort.',
    en: '⭐ You rated RATING/5 stars.\n\nWe\'re sorry your experience wasn\'t perfect. 😔\nCould you tell us what went wrong? Please describe the issue briefly.',
  },
  notSeriousResponse: {
    ar: 'شكراً لملاحظاتك. لقد سجلنا مخاوفك وسنستخدمها لتحسين خدمتنا.\n\nإذا كنت بحاجة إلى مساعدة إضافية، يرجى التواصل مع فريق الدعم. 🚕',
    dk: 'Tak for din feedback. Vi har noteret dine bekymringer og vil bruge dem til at forbedre vores service.\n\nHvis du har brug for yderligere hjælp, kontakt venligst vores supportteam. 🚕',
    en: 'Thank you for your feedback. We\'ve noted your concerns and will use them to improve our service.\n\nIf you need further assistance, please contact our support team. 🚕',
  },
  complaintConfirmPrompt: {
    ar: 'بناءً على ملاحظاتك، يبدو أنه قد تكون هناك مشكلة خطيرة في رحلتك.\n\n*ملخص:* SUMMARY\n\nهل ترغب في تقديم شكوى رسمية؟',
    dk: 'Baseret på din feedback ser det ud til, at der kan have været et alvorligt problem med din tur.\n\n*Resumé:* SUMMARY\n\nVil du indgive en officiel klage?',
    en: 'Based on your feedback, it seems there may have been a serious issue with your ride.\n\n*Summary:* SUMMARY\n\nWould you like to file an official complaint?',
  },
  complaintYesBtn: {
    ar: '✅ نعم',
    dk: '✅ Ja',
    en: '✅ Yes',
  },
  complaintNoBtn: {
    ar: '❌ لا',
    dk: '❌ Nej',
    en: '❌ No',
  },
  complaintDeclined: {
    ar: 'شكراً لملاحظاتك. لقد سجلنا مخاوفك.\nإذا غيرت رأيك، يمكنك التواصل مع فريق الدعم في أي وقت. 🚕',
    dk: 'Tak for din feedback. Vi har noteret dine bekymringer.\nHvis du ombestemmer dig, kan du kontakte vores supportteam når som helst. 🚕',
    en: 'Thank you for your feedback. We\'ve noted your concerns.\nIf you change your mind, you can contact our support team anytime. 🚕',
  },
  complaintFiled: {
    ar: '✅ *تم تقديم الشكوى بنجاح!*\n\nتم تسجيل شكواك للرحلة #RIDE.\nسيقوم فريقنا بمراجعتها والتواصل معك.\n\nشكراً لمساعدتنا في تحسين خدمتنا. 🚕',
    dk: '✅ *Klage indgivet!*\n\nDin klage for tur #RIDE er blevet registreret.\nVores team vil gennemgå den og vende tilbage til dig.\n\nTak fordi du hjælper os med at forbedre vores service. 🚕',
    en: '✅ *Complaint filed successfully!*\n\nYour complaint for ride #RIDE has been registered.\nOur team will review it and get back to you.\n\nThank you for helping us improve our service. 🚕',
  },
  complaintExists: {
    ar: 'لقد قدمت شكوى مسبقاً لهذه الرحلة.',
    dk: 'Du har allerede indgivet en klage for denne tur.',
    en: 'You have already filed a complaint for this ride.',
  },
  complaintFailed: {
    ar: '❌ فشل تقديم الشكوى. الرجاء المحاولة مرة أخرى أو التواصل مع الدعم.',
    dk: '❌ Kunne ikke indgive klage. Prøv igen eller kontakt support.',
    en: '❌ Failed to file complaint. Please try again or contact support.',
  },
};

function t(key: keyof typeof MSG, lang: Lang, replacements?: Record<string, string>): string {
  let text = (MSG as any)[key][lang] || (MSG as any)[key]['en'];
  if (replacements) {
    for (const [k, v] of Object.entries(replacements)) {
      text = text.replace(k, v);
    }
  }
  return text;
}

export async function sendRatingButtons(phone: string, rideId: number) {
  const lang = getLang(phone);
  const msgBody = t('ratePrompt', lang, { '#RIDE': String(rideId) });
  sendWAButtons(phone, msgBody, [
    { id: `rate_4_${rideId}`, title: '⭐⭐⭐⭐' },
    { id: `rate_5_${rideId}`, title: '⭐⭐⭐⭐⭐' },
  ]).catch(() => {});
  sendWAButtons(phone, t('highStarsLabel', lang), [
    { id: `rate_1_${rideId}`, title: '⭐' },
    { id: `rate_2_${rideId}`, title: '⭐⭐' },
    { id: `rate_3_${rideId}`, title: '⭐⭐⭐' },
  ]).catch(() => {});
}

export async function handleRatingClick(phone: string, rideId: number, rating: number) {
  if (rating < 1 || rating > 5) return;

  const user = await prisma.user.findFirst({ where: { phone: phone.trim() } });
  if (!user) return;

  const lang = getLang(phone);

  const ride = await (prisma as any).ride.findUnique({
    where: { id: rideId },
    select: { id: true, userId: true, driverId: true, status: true, customerRating: true },
  });

  if (!ride || ride.userId !== user.id) {
    await sendWAText(phone, t('notYourRide', lang));
    return;
  }

  if (ride.customerRating) {
    await sendWAText(phone, t('alreadyRated', lang));
    return;
  }

  const driverId = ride.driverId;
  if (!driverId) return;

  const driver = await (prisma as any).comDriver.findUnique({
    where: { id: driverId },
    select: { id: true, rating: true, fiveStarCount: true },
  });

  const currentRating = Number(driver?.rating || 5);
  const currentFiveStarCount = Number(driver?.fiveStarCount || 0);

  if (rating === 5) {
    const newCount = currentFiveStarCount + 1;
    const shouldIncrease = newCount >= 5;
    const newRating = shouldIncrease
      ? Math.min(5.0, Number((currentRating + 0.01).toFixed(2)))
      : currentRating;
    const finalCount = shouldIncrease ? 0 : newCount;

    await (prisma as any).$transaction(async (tx: any) => {
      await tx.ride.update({
        where: { id: rideId },
        data: { customerRating: rating, customerRatedAt: new Date() },
      });
      await tx.comDriver.update({
        where: { id: driverId },
        data: { rating: newRating, fiveStarCount: finalCount },
      });
    });

    await sendWAText(phone, t('thankYou5', lang, { '#RIDE': String(rideId) }));
    return;
  }

  if (rating === 1) {
    const newRating = Math.max(0, Number((currentRating - 0.02).toFixed(2)));
    await (prisma as any).$transaction(async (tx: any) => {
      await tx.ride.update({
        where: { id: rideId },
        data: { customerRating: rating, customerRatedAt: new Date() },
      });
      await tx.comDriver.update({
        where: { id: driverId },
        data: { rating: newRating },
      });
    });
  } else if (rating === 2 || rating === 3) {
    const newRating = Math.max(0, Number((currentRating - 0.01).toFixed(2)));
    await (prisma as any).$transaction(async (tx: any) => {
      await tx.ride.update({
        where: { id: rideId },
        data: { customerRating: rating, customerRatedAt: new Date() },
      });
      await tx.comDriver.update({
        where: { id: driverId },
        data: { rating: newRating },
      });
    });
  } else if (rating === 4) {
    await (prisma as any).$transaction(async (tx: any) => {
      await tx.ride.update({
        where: { id: rideId },
        data: { customerRating: rating, customerRatedAt: new Date() },
      });
    });
    await sendWAText(phone, t('thankYou4', lang, { '#RIDE': String(rideId) }));
    return;
  }

  let s = getUserSession(phone);
  if (!s) {
    s = createSession(phone, { stage: 'menu', userId: user.id, userExists: true, firstName: user.firstName || '' });
    s.collected['_language'] = lang;
  }

  s.collected['_ratingRideId'] = String(rideId);
  s.collected['_ratingValue'] = String(rating);
  s.collected['_ratingAwaitingComplaint'] = 'true';
  touchSession(s);

  await sendWAText(phone, t('problemPrompt', lang, { 'RATING': String(rating) }));
}

export async function handleRatingComplaintInput(phone: string, msg: string): Promise<boolean> {
  const s = getUserSession(phone);
  if (!s?.collected?.['_ratingAwaitingComplaint']) return false;

  const lang = (s.collected['_language'] as Lang) || 'en';
  const rideId = parseInt(s.collected['_ratingRideId'] || '0');
  const rating = parseInt(s.collected['_ratingValue'] || '0');

  if (!rideId || !rating) {
    delete s.collected['_ratingAwaitingComplaint'];
    delete s.collected['_ratingRideId'];
    delete s.collected['_ratingValue'];
    touchSession(s);
    return true;
  }

  delete s.collected['_ratingAwaitingComplaint'];
  s.collected['_ratingComplaintText'] = msg;
  touchSession(s);

  const aiResult = await evaluateProblemSeverity(msg, rideId, rating);

  if (!aiResult.isSerious) {
    await sendWAText(phone, t('notSeriousResponse', lang));
    delete s.collected['_ratingRideId'];
    delete s.collected['_ratingValue'];
    delete s.collected['_ratingComplaintText'];
    touchSession(s);
    return true;
  }

  s.collected['_ratingAiSummary'] = aiResult.summary || '';
  s.collected['_ratingAwaitingComplaintConfirm'] = 'true';
  touchSession(s);

  const confirmMsg = t('complaintConfirmPrompt', lang, { 'SUMMARY': aiResult.summary || '' });
  const buttons = [
    { id: `complaint_yes_${rideId}`, title: t('complaintYesBtn', lang) },
    { id: `complaint_no_${rideId}`, title: t('complaintNoBtn', lang) },
  ];
  await sendWAButtons(phone, confirmMsg, buttons);
  return true;
}

export async function handleComplaintConfirm(phone: string, rideId: number, isYes: boolean) {
  const s = getUserSession(phone);
  if (!s?.collected?.['_ratingAwaitingComplaintConfirm']) return;
  if (parseInt(s.collected['_ratingRideId'] || '0') !== rideId) return;

  const lang = (s.collected['_language'] as Lang) || 'en';
  delete s.collected['_ratingAwaitingComplaintConfirm'];

  if (!isYes) {
    await sendWAText(phone, t('complaintDeclined', lang));
    delete s.collected['_ratingRideId'];
    delete s.collected['_ratingValue'];
    delete s.collected['_ratingComplaintText'];
    delete s.collected['_ratingAiSummary'];
    touchSession(s);
    return;
  }

  const complaintText = s.collected['_ratingComplaintText'] || '';
  const aiSummary = s.collected['_ratingAiSummary'] || '';

  const writtenComplaint = await writeComplaintText(complaintText, aiSummary, rideId);

  const user = await prisma.user.findFirst({ where: { phone: phone.trim() } });
  if (!user) return;

  try {
    const existing = await (prisma as any).complaint.findFirst({
      where: { rideId, userId: user.id },
    });
    if (existing) {
      await sendWAText(phone, t('complaintExists', lang));
      return;
    }

    await (prisma as any).complaint.create({
      data: {
        userId: user.id,
        rideId,
        complaint: JSON.stringify([`Me: ${writtenComplaint}`]),
        status: 'OPEN',
      },
    });

    await sendWAText(phone, t('complaintFiled', lang, { '#RIDE': String(rideId) }));

    const adminEmail = process.env.ADMIN_EMAIL || process.env.CONTACT_EMAIL;
    if (adminEmail) {
      import('@/lib/email').then(({ sendEmail }) =>
        sendEmail(
          adminEmail,
          `New WhatsApp Complaint - Ride #${rideId}`,
          `<p>A new complaint was filed via WhatsApp:</p>
          <ul>
            <li><strong>Customer:</strong> ${user.firstName} ${user.lastName} (${user.email})</li>
            <li><strong>Ride ID:</strong> ${rideId}</li>
            <li><strong>Complaint:</strong> ${writtenComplaint}</li>
          </ul>
          <p>Please review in the admin panel.</p>`
        )
      ).catch(() => {});
    }
  } catch (e) {
    logWAError('complaint_create_failed', e);
    await sendWAText(phone, t('complaintFailed', lang));
  }

  delete s.collected['_ratingRideId'];
  delete s.collected['_ratingValue'];
  delete s.collected['_ratingComplaintText'];
  delete s.collected['_ratingAiSummary'];
  touchSession(s);
}

async function evaluateProblemSeverity(
  userText: string,
  rideId: number,
  rating: number,
): Promise<{ isSerious: boolean; summary: string }> {
  try {
    const openai = getOpenAI();
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      max_tokens: 300,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You are evaluating a customer complaint for a taxi ride service (944 Trafik, Denmark).
The customer rated the ride ${rating}/5 stars and described the issue.

Determine if this is a SERIOUS issue that warrants an official complaint. Serious issues include:
- Safety concerns (reckless driving, accidents)
- Unethical behavior (harassment, discrimination, racism)
- Illegal activity (refusing meter, overcharging significantly)
- Physical altercations or threats
- Severe unprofessional conduct

Non-serious issues (not warranting complaint):
- Minor delays or traffic
- Car cleanliness
- Music/AC preferences
- Minor rudeness or unfriendly attitude
- Route preferences

Respond with JSON: {"isSerious": boolean, "summary": "brief summary in English, max 50 words"}`,
        },
        {
          role: 'user',
          content: `Ride #${rideId}, Rating: ${rating}/5. Customer says: "${userText}"`,
        },
      ],
    });

    const content = response.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(content);
    return {
      isSerious: !!parsed.isSerious,
      summary: parsed.summary || 'Issue reported by customer',
    };
  } catch (e) {
    logWAError('rating_ai_evaluate_failed', e);
    return { isSerious: false, summary: '' };
  }
}

async function writeComplaintText(
  userText: string,
  aiSummary: string,
  rideId: number,
): Promise<string> {
  try {
    const openai = getOpenAI();
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.3,
      max_tokens: 400,
      messages: [
        {
          role: 'system',
          content: `You are writing an official complaint for a taxi ride service (944 Trafik, Denmark).
Write a professional, clear, and concise complaint based on the customer's description.
The complaint must be:
- In English
- No more than 200 words
- Written in first person as if you are the customer
- Include the ride number and key facts
- Be factual and professional in tone
- Include what happened and what resolution is expected

Output ONLY the complaint text, no JSON wrapper, no extra formatting.`,
        },
        {
          role: 'user',
          content: `Ride #${rideId}. AI summary: "${aiSummary}". Customer original description: "${userText}"\n\nWrite the official complaint:`,
        },
      ],
    });

    const text = response.choices[0]?.message?.content || userText;
    const words = text.split(/\s+/);
    if (words.length > 200) {
      return words.slice(0, 200).join(' ') + '...';
    }
    return text.trim();
  } catch (e) {
    logWAError('rating_ai_write_complaint_failed', e);
    return userText.length > 1000 ? userText.substring(0, 1000) : userText;
  }
}
