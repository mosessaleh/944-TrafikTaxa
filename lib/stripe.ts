import Stripe from 'stripe';

let stripe: Stripe | null = null;

function getStripe() {
  if (!stripe) {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      throw new Error('STRIPE_SECRET_KEY environment variable is required');
    }
    stripe = new Stripe(secretKey, {
      apiVersion: '2025-09-30.clover',
    });
  }
  return stripe;
}

export { getStripe as stripe };

export async function createPaymentIntent(amount: number, currency: string = 'dkk', metadata?: Record<string, string>) {
  const stripe = getStripe();
  return await stripe.paymentIntents.create({
    amount: Math.round(amount * 100), // Convert to smallest currency unit (øre for DKK)
    currency,
    metadata,
    automatic_payment_methods: {
      enabled: true,
    },
  });
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