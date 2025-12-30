import { NextRequest, NextResponse } from 'next/server';
import { getUserFromCookie } from '@/lib/auth';
import { stripe } from '@/lib/stripe';
import { prisma } from '@/lib/db';

/**
 * POST /api/user/payment-methods/setup-intent - Create Stripe Setup Intent
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromCookie();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const stripeClient = stripe();

    // Check if user has a Stripe customer, create one if not
    const userWithCustomer = await prisma.$queryRaw`
      SELECT stripeCustomerId FROM User WHERE id = ${user.id}
    ` as any[];

    let customerId = userWithCustomer[0]?.stripeCustomerId;

    if (!customerId) {
      // Create a new Stripe customer
      const customer = await stripeClient.customers.create({
        email: (user as any).email,
        name: `${(user as any).firstName} ${(user as any).lastName}`,
        phone: (user as any).phone,
        metadata: {
          userId: user.id.toString(),
          databaseId: user.id.toString()
        }
      });

      customerId = customer.id;

      // Save the customer ID to the user record using raw SQL
      await prisma.$executeRaw`
        UPDATE User SET stripeCustomerId = ${customerId} WHERE id = ${user.id}
      `;
    }

    // Create a Setup Intent for collecting payment method
    const setupIntent = await stripeClient.setupIntents.create({
      payment_method_types: ['card'],
      usage: 'off_session', // Allow future off-session payments
      metadata: {
        userId: user.id.toString(),
        purpose: 'save_payment_method'
      }
    });

    return NextResponse.json({
      success: true,
      clientSecret: setupIntent.client_secret,
      setupIntentId: setupIntent.id
    });

  } catch (error: any) {
    console.error('Error creating setup intent:', error);
    return NextResponse.json(
      { error: 'Failed to create setup intent', details: error.message },
      { status: 500 }
    );
  }
}