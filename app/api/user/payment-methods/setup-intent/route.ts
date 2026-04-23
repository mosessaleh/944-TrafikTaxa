import { NextRequest, NextResponse } from 'next/server';
import { getAuthSecret, getUserFromCookie } from '@/lib/auth';
import { stripe } from '@/lib/stripe';
import { prisma } from '@/lib/db';
import { verify } from 'jsonwebtoken';

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

/**
 * POST /api/user/payment-methods/setup-intent - Create Stripe Setup Intent
 */
export async function POST(request: NextRequest) {
  try {
    const bearerUser = await getUserFromBearerToken(request);
    const cookieUser = await getUserFromCookie();
    const authUser = bearerUser || cookieUser;
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const stripeClient = stripe();
    const fullUser = cookieUser?.id === authUser.id
      ? cookieUser
      : await (prisma as any).user.findUnique({
          where: { id: authUser.id },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
          },
        });

    if (!fullUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if user has a Stripe customer, create one if not
    const userWithCustomer = await prisma.$queryRaw`
      SELECT stripeCustomerId FROM User WHERE id = ${authUser.id}
    ` as any[];

    let customerId = userWithCustomer[0]?.stripeCustomerId;

    if (!customerId) {
      // Create a new Stripe customer
      const customer = await stripeClient.customers.create({
        email: fullUser.email || undefined,
        name: [fullUser.firstName, fullUser.lastName].filter(Boolean).join(' ') || undefined,
        phone: fullUser.phone || undefined,
        metadata: {
          userId: authUser.id.toString(),
          databaseId: authUser.id.toString()
        }
      });

      customerId = customer.id;

      // Save the customer ID to the user record using raw SQL
      await prisma.$executeRaw`
        UPDATE User SET stripeCustomerId = ${customerId} WHERE id = ${authUser.id}
      `;
    }

    // Create a Setup Intent for collecting payment method
    const setupIntent = await stripeClient.setupIntents.create({
      customer: customerId,
      payment_method_types: ['card'],
      usage: 'off_session', // Allow future off-session payments
      metadata: {
        userId: authUser.id.toString(),
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
