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

    const sql = includeEnded
      ? `
        SELECT id, slug, title, body, publishedAt, status, sortOrder, createdAt, updatedAt
        FROM CompanyNews
        ORDER BY sortOrder ASC, publishedAt DESC, id DESC
        ${limit ? `LIMIT ${limit}` : ''}
      `
      : `
        SELECT id, slug, title, body, publishedAt, status, sortOrder, createdAt, updatedAt
        FROM CompanyNews
        WHERE status = 'ACTIVE'
        ORDER BY sortOrder ASC, publishedAt DESC, id DESC
        ${limit ? `LIMIT ${limit}` : ''}
      `;

    const items = await prisma.$queryRawUnsafe(sql);

    return NextResponse.json({ ok: true, items });
  } catch (error) {
    console.error('Failed to fetch company news:', error);
    return NextResponse.json({ ok: false, error: 'Failed to fetch company news' }, { status: 500 });
  }
}
