import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getUserFromCookie } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const user = await getUserFromCookie();
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const drCard = searchParams.get('drCard');
    const companyId = searchParams.get('companyId');

    if (!drCard) {
      return NextResponse.json({ ok: false, error: 'Driver card number is required' }, { status: 400 });
    }

    let whereCondition: any = {
      drCard: drCard.trim(),
    };

    // If user is partner, only search in their company
    if (user.type === 'partner') {
      whereCondition.comId = user.id;
    }
    // If user is admin, they can search in any company or specify companyId
    else if (user.type === 'user' && (user as any).role === 'ADMIN') {
      if (companyId) {
        whereCondition.comId = parseInt(companyId);
      }
      // If no companyId specified for admin, search across all companies
    }
    else {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Search for driver
    const driver = await prisma.comDriver.findFirst({
      where: whereCondition,
      select: {
        id: true,
        drFname: true,
        drLname: true,
        drCard: true,
        company: {
          select: {
            comName: true,
          },
        },
      },
    });

    return NextResponse.json({
      ok: true,
      driver: driver || null,
    });
  } catch (error) {
    console.error('Search driver error:', error);
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}