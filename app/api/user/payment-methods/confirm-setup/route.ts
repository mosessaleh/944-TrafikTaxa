import { NextRequest, NextResponse } from 'next/server';
import { getAuthSecret, getUserFromCookie } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { stripe } from '@/lib/stripe';
import { verify } from 'jsonwebtoken';
import { z } from 'zod';

const JWT_SECRET = getAuthSecret();

async function getUserFromBearerToken(request: NextRequest) {
  const authHeader = request.headers.get('authorization') || '';
  if (!authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7).trim();
  if (!token) {
    return null;
  }

  try {
    const decoded = verify(token, JWT_SECRET) as { id?: number; type?: string };
    if (decoded?.type && decoded.type !== 'user') {
      return null;
    }

    const userId = Number(decoded?.id);
    if (!Number.isFinite(userId) || userId <= 0) {
      return null;
    }

    return { id: userId };
  } catch {
    return null;
  }
}

const ConfirmSetupSchema = z.object({
  setupIntentId: z.string(),
  isDefault: z.boolean().optional()
});

/**
 * POST /api/user/payment-methods/confirm-setup - Confirm setup intent and save payment method
 */
export async function POST(request: NextRequest) {
  try {
    const bearerUser = await getUserFromBearerToken(request);
    const user = bearerUser || await getUserFromCookie();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { setupIntentId, isDefault } = ConfirmSetupSchema.parse(body);

    const stripeClient = stripe();

    // Get user's Stripe customer ID
    const userWithCustomer = await prisma.$queryRaw`
      SELECT stripeCustomerId FROM User WHERE id = ${user.id}
    ` as any[];

    const customerId = userWithCustomer[0]?.stripeCustomerId;

    if (!customerId) {
      return NextResponse.json({ error: 'User does not have a Stripe customer' }, { status: 400 });
    }

    // Retrieve the setup intent
    const setupIntent = await stripeClient.setupIntents.retrieve(setupIntentId);

    if (setupIntent.status !== 'succeeded') {
      return NextResponse.json({
        error: 'Setup intent not completed',
        status: setupIntent.status
      }, { status: 400 });
    }

    if (!setupIntent.payment_method) {
      return NextResponse.json({
        error: 'No payment method attached to setup intent'
      }, { status: 400 });
    }

    // Ensure the payment method is attached to the customer
    try {
      await stripeClient.paymentMethods.attach(setupIntent.payment_method as string, { customer: customerId });
    } catch (attachError: any) {
      // If already attached, ignore the error
      if (!attachError.message?.includes('already attached')) {
        throw attachError;
      }
    }

    // Get payment method details from Stripe
    const paymentMethod = await stripeClient.paymentMethods.retrieve(
      setupIntent.payment_method as string
    );

    if (paymentMethod.type !== 'card') {
      return NextResponse.json({
        error: 'Only card payment methods are supported'
      }, { status: 400 });
    }

    const card = paymentMethod.card;
    if (!card) {
      return NextResponse.json({
        error: 'Invalid card details'
      }, { status: 400 });
    }

    // If setting as default, unset other defaults first
    if (isDefault) {
      await (prisma as any).userPaymentMethod.updateMany({
        where: { userId: user.id },
        data: { isDefault: false }
      });
    }

    // Save the payment method to database
    const savedMethod = await (prisma as any).userPaymentMethod.create({
      data: {
        userId: user.id,
        type: 'card',
        provider: 'stripe',
        token: setupIntent.payment_method as string, // Store Stripe payment method ID
        last4: card.last4,
        expiryMonth: card.exp_month,
        expiryYear: card.exp_year,
        isDefault: isDefault || false,
        isActive: true
      },
      select: {
        id: true,
        type: true,
        provider: true,
        last4: true,
        expiryMonth: true,
        expiryYear: true,
        isDefault: true,
        createdAt: true
      }
    });

    return NextResponse.json({
      success: true,
      paymentMethod: savedMethod,
      message: 'Payment method saved successfully'
    });

  } catch (error) {
    console.error('Error confirming setup:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input data', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to save payment method' },
      { status: 500 }
    );
  }
}
