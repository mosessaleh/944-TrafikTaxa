import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getUserFromCookie } from '@/lib/auth';
import { sanitizeInput } from '@/lib/sanitize';
import { limitOrThrow, clientIpKey } from '@/lib/rate-limit';

/**
 * GET /api/favorites - Fetch user's favorite addresses
 */
export async function GET(request: NextRequest) {
  try {
    // Rate limiting
    await limitOrThrow('favorites:' + clientIpKey(request), { points: 30, durationSec: 60 });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: 'Too many requests, try again later.' },
      { status: error?.status || 429 }
    );
  }

  try {
    // Authentication
    const user = await getUserFromCookie();
    if (!user) {
      return NextResponse.json(
        { ok: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Fetch favorites
    const favorites = await prisma.favoriteAddress.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        label: true,
        address: true,
        lat: true,
        lon: true,
        createdAt: true
      }
    });

    return NextResponse.json({
      ok: true,
      favorites,
      count: favorites.length
    });

  } catch (error) {
    console.error('[API] Error fetching favorites:', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to fetch favorites' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/favorites - Create a new favorite address
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    await limitOrThrow('favorites:' + clientIpKey(request), { points: 10, durationSec: 60 });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: 'Too many requests, try again later.' },
      { status: error?.status || 429 }
    );
  }

  try {
    // Authentication
    const user = await getUserFromCookie();
    if (!user) {
      return NextResponse.json(
        { ok: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();

    // Validate and sanitize inputs
    const label = sanitizeInput(body?.label, 'text')?.trim();
    const address = sanitizeInput(body?.address, 'address')?.trim();
    const lat = typeof body?.lat === 'number' && body.lat >= -90 && body.lat <= 90 ? body.lat : null;
    const lon = typeof body?.lon === 'number' && body.lon >= -180 && body.lon <= 180 ? body.lon : null;

    // Validation
    if (!label || label.length < 2 || label.length > 100) {
      return NextResponse.json(
        { ok: false, error: 'Label must be between 2 and 100 characters' },
        { status: 400 }
      );
    }

    if (!address || address.length < 3 || address.length > 500) {
      return NextResponse.json(
        { ok: false, error: 'Address must be between 3 and 500 characters' },
        { status: 400 }
      );
    }

    // Check for duplicates
    const existing = await prisma.favoriteAddress.findFirst({
      where: { userId: user.id, address }
    });

    if (existing) {
      return NextResponse.json({
        ok: true,
        favorite: existing,
        message: 'Address already exists in favorites'
      });
    }

    // Create favorite
    const favorite = await prisma.favoriteAddress.create({
      data: {
        userId: user.id,
        label,
        address,
        lat,
        lon
      },
      select: {
        id: true,
        label: true,
        address: true,
        lat: true,
        lon: true,
        createdAt: true
      }
    });

    return NextResponse.json({
      ok: true,
      favorite
    }, { status: 201 });

  } catch (error) {
    console.error('[API] Error creating favorite:', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to create favorite' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/favorites?id={id} - Delete a favorite address
 */
export async function DELETE(request: NextRequest) {
  try {
    // Rate limiting
    await limitOrThrow('favorites:' + clientIpKey(request), { points: 10, durationSec: 60 });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: 'Too many requests, try again later.' },
      { status: error?.status || 429 }
    );
  }

  try {
    // Authentication
    const user = await getUserFromCookie();
    if (!user) {
      return NextResponse.json(
        { ok: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get favorite ID from query params
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id || isNaN(Number(id))) {
      return NextResponse.json(
        { ok: false, error: 'Valid favorite ID is required' },
        { status: 400 }
      );
    }

    // Find and verify ownership
    const favorite = await prisma.favoriteAddress.findUnique({
      where: { id: Number(id) }
    });

    if (!favorite) {
      return NextResponse.json(
        { ok: false, error: 'Favorite not found' },
        { status: 404 }
      );
    }

    if (favorite.userId !== user.id) {
      return NextResponse.json(
        { ok: false, error: 'Access denied' },
        { status: 403 }
      );
    }

    // Delete favorite
    await prisma.favoriteAddress.delete({
      where: { id: Number(id) }
    });

    return NextResponse.json({
      ok: true,
      message: 'Favorite deleted successfully'
    });

  } catch (error) {
    console.error('[API] Error deleting favorite:', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to delete favorite' },
      { status: 500 }
    );
  }
}