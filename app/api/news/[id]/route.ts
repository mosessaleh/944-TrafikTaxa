import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(_: Request, { params }: { params: { id: string } }) {
  try {
    const id = Number(params.id);
    if (!Number.isFinite(id)) {
      return NextResponse.json({ ok: false, error: 'Invalid news id' }, { status: 400 });
    }

    const item = await prisma.companyNews.findUnique({
      where: { id },
    });

    if (!item) {
      return NextResponse.json({ ok: false, error: 'News item not found' }, { status: 404 });
    }

    return NextResponse.json({ ok: true, item });
  } catch (error) {
    console.error('Failed to fetch company news item:', error);
    return NextResponse.json({ ok: false, error: 'Failed to fetch company news item' }, { status: 500 });
  }
}
