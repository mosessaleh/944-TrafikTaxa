import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requirePermission } from '@/lib/auth';
import { validateRequestOrigin } from '@/lib/security-headers';

export async function GET(request: Request) {
  try {
    const originCheck = validateRequestOrigin(request);
    if (!originCheck.ok) {
      return NextResponse.json(
        { ok: false, error: 'Invalid request origin' },
        { status: 403 }
      );
    }

    // Require admin authentication
    await requirePermission('partners.manage');

    const companies = await prisma.partnerCompany.findMany({
      include: {
        _count: {
          select: {
            drivers: true,
            vehicles: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({ ok: true, data: companies });
  } catch (e: any) {
    if (e.status === 401 || e.status === 403) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: e.status });
    }
    return NextResponse.json({ ok: false, error: e?.message || 'Failed to fetch companies' }, { status: 500 });
  }
}
