import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const includeEnded = searchParams.get('includeEnded') === '1';
    const limitParam = searchParams.get('limit');
    const parsedLimit = limitParam ? Number(limitParam) : NaN;
    const hasLimit = Number.isFinite(parsedLimit);
    const limit = hasLimit ? Math.max(1, Math.min(parsedLimit, 50)) : null;

    const items = await prisma.companyNews.findMany({
      where: includeEnded ? {} : { status: 'ACTIVE' },
      orderBy: [
        { sortOrder: 'asc' },
        { publishedAt: 'desc' },
        { id: 'desc' },
      ],
      ...(limit ? { take: limit } : {}),
      select: {
        id: true,
        slug: true,
        title: true,
        body: true,
        publishedAt: true,
        status: true,
        sortOrder: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ ok: true, items });
  } catch (error) {
    console.error('Failed to fetch company news:', error);
    return NextResponse.json({ ok: false, error: 'Failed to fetch company news' }, { status: 500 });
  }
}
