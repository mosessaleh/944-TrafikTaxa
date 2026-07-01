import Stripe from 'stripe';

let stripe: Stripe | null = null;

function getStripe() {
  if (!stripe) {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      throw new Error('STRIPE_SECRET_KEY environment variable is required');
    }
    // Use Stripe client with the default API version configured on your dashboard
    stripe = new Stripe(secretKey);
  }
  return stripe;
}

export { getStripe as stripe };

export async function createPaymentIntent(
  amount: number,
  currency: string = 'dkk',
  metadata?: Record<string, string>,
  idempotencyKey?: string
) {
  const stripe = getStripe();

  const params: Stripe.PaymentIntentCreateParams = {
    amount: Math.round(amount * 100), // Convert to smallest currency unit (øre for DKK)
    currency,
    metadata,
    automatic_payment_methods: {
      enabled: true,
    },
  };

  // Enable idempotency so repeated client calls for the same booking/invoice
  // cannot create multiple different PaymentIntents with different amounts.
  const options: Stripe.RequestOptions | undefined = idempotencyKey
    ? { idempotencyKey }
    : undefined;

  return await stripe.paymentIntents.create(params, options);
}

export async function confirmPaymentIntent(paymentIntentId: string) {
  const stripe = getStripe();
  return await stripe.paymentIntents.confirm(paymentIntentId);
}

export async function retrievePaymentIntent(paymentIntentId: string) {
  const stripe = getStripe();
  return await stripe.paymentIntents.retrieve(paymentIntentId);
}

export async function createCheckoutSession(params: {
  amount: number;
  currency?: string;
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
}) {
  const { amount, currency = 'dkk', successUrl, cancelUrl, metadata } = params;
  const stripe = getStripe();

  return await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency,
          product_data: {
            name: '944 Trafik Taxi Booking',
            description: 'Professional taxi service payment',
          },
          unit_amount: Math.round(amount * 100),
        },
        quantity: 1,
      },
    ],
    mode: 'payment',
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata,
  });
}

export async function createWhatsAppPaymentSession(params: {
  bookingId: number;
  amount: number;
  userPhone: string;
  baseUrl: string;
}): Promise<{ url: string }> {
  const { bookingId, amount, userPhone, baseUrl } = params;

  const session = await createCheckoutSession({
    amount,
    currency: 'dkk',
    successUrl: `${baseUrl}/booking-confirmed?id=${bookingId}`,
    cancelUrl: `${baseUrl}/booking-cancelled?id=${bookingId}`,
    metadata: {
      bookingId: String(bookingId),
      source: 'whatsapp',
      userPhone,
    },
  });

  return { url: session.url || '' };
}

export async function retrieveCheckoutSession(sessionId: string) {
  const stripe = getStripe();
  return await stripe.checkout.sessions.retrieve(sessionId);
}

export function constructWebhookEvent(payload: Buffer, signature: string) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error('STRIPE_WEBHOOK_SECRET not configured');
  const stripe = getStripe();
  return stripe.webhooks.constructEvent(payload, signature, secret);
}