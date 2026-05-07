import { NextRequest, NextResponse } from 'next/server';
import { getAuthSecret, getUserFromCookie } from '@/lib/auth';
import { encryptPaymentToken } from '@/lib/crypto';
import { prisma } from '@/lib/db';
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

// Validation schemas
const CreatePaymentMethodSchema = z.object({
  type: z.enum(['card', 'paypal', 'revolut']),
  provider: z.enum(['stripe', 'paypal', 'revolut']),
  token: z.string().min(1),
  last4: z.string().optional(),
  expiryMonth: z.number().min(1).max(12).optional(),
  expiryYear: z.number().min(2024).optional(),
  isDefault: z.boolean().optional()
});

const UpdatePaymentMethodSchema = z.object({
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional()
});

/**
 * GET /api/user/payment-methods - Get user's saved payment methods
 */
export async function GET(request: NextRequest) {
  try {
    const bearerUser = await getUserFromBearerToken(request);
    const user = bearerUser || await getUserFromCookie();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const paymentMethods = await (prisma as any).userPaymentMethod.findMany({
      where: {
        userId: user.id,
        isActive: true
      },
      orderBy: [
        { isDefault: 'desc' },
        { createdAt: 'desc' }
      ],
      select: {
        id: true,
        type: true,
        provider: true,
        last4: true,
        expiryMonth: true,
        expiryYear: true,
        isDefault: true,
        isActive: true,
        createdAt: true
      }
    });

    return NextResponse.json({
      success: true,
      paymentMethods
    });

  } catch (error) {
    console.error('Error fetching payment methods:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/user/payment-methods - Add new payment method
 */
export async function POST(request: NextRequest) {
  try {
    const bearerUser = await getUserFromBearerToken(request);
    const user = bearerUser || await getUserFromCookie();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = CreatePaymentMethodSchema.parse(body);

    // If setting as default, unset other defaults first
    if (validatedData.isDefault) {
      await (prisma as any).userPaymentMethod.updateMany({
        where: { userId: user.id },
        data: { isDefault: false }
      });
    }

    const encryptedToken = encryptPaymentToken(validatedData.token);

    const paymentMethod = await (prisma as any).userPaymentMethod.create({
      data: {
        userId: user.id,
        type: validatedData.type,
        provider: validatedData.provider,
        token: encryptedToken,
        last4: validatedData.last4,
        expiryMonth: validatedData.expiryMonth,
        expiryYear: validatedData.expiryYear,
        isDefault: validatedData.isDefault || false,
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
      paymentMethod,
      message: 'Payment method added successfully'
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating payment method:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input data', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to add payment method' },
      { status: 500 }
    );
  }
}
