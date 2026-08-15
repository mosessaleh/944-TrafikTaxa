import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requirePermission } from '@/lib/auth';

const NewsInput = z.object({
  id: z.number().int().positive().optional(),
  title: z.string().trim().min(3).max(160),
  body: z.string().trim().min(10),
  publishedAt: z.string().min(1),
  status: z.enum(['ACTIVE', 'ENDED']),
  sortOrder: z.number().int().min(0).max(9999).default(0),
});

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

async function buildUniqueSlug(title: string, currentId?: number) {
  const base = slugify(title) || `news-${Date.now()}`;
  let candidate = base;
  let suffix = 1;

  while (true) {
    const existing = await prisma.companyNews.findFirst({
      where: {
        slug: candidate,
        ...(currentId ? { id: { not: currentId } } : {}),
      },
      select: { id: true },
    });

    if (!existing) return candidate;
    suffix += 1;
    candidate = `${base}-${suffix}`;
  }
}

export async function GET() {
  try {
    await requirePermission('news.manage');
  } catch {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  }

  // SAFE: static query, no user input
  const items = await prisma.$queryRawUnsafe(`
    SELECT id, slug, title, body, publishedAt, status, sortOrder, createdAt, updatedAt
    FROM CompanyNews
    ORDER BY status ASC, sortOrder ASC, publishedAt DESC, id DESC
  `);

  return NextResponse.json({ ok: true, items });
}

export async function POST(request: Request) {
  try {
    await requirePermission('news.manage');
  } catch {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const data = NewsInput.parse({
      ...body,
      sortOrder: Number(body?.sortOrder ?? 0),
    });

    const publishedAt = new Date(data.publishedAt);
    if (Number.isNaN(publishedAt.getTime())) {
      return NextResponse.json({ ok: false, error: 'Invalid publication date' }, { status: 400 });
    }

    const slug = await buildUniqueSlug(data.title, data.id);

    if (data.id) {
      const item = await prisma.companyNews.update({
        where: { id: data.id },
        data: {
          slug,
          title: data.title,
          body: data.body,
          publishedAt,
          status: data.status,
          sortOrder: data.sortOrder,
        },
      });
      return NextResponse.json({ ok: true, item });
    }

    const item = await prisma.companyNews.create({
      data: {
        slug,
        title: data.title,
        body: data.body,
        publishedAt,
        status: data.status,
        sortOrder: data.sortOrder,
      },
    });
    return NextResponse.json({ ok: true, item });
  } catch (error: any) {
    if (error?.issues) {
      return NextResponse.json({ ok: false, error: 'Validation failed', issues: error.issues }, { status: 400 });
    }

    console.error('Failed to save company news:', error);
    return NextResponse.json({ ok: false, error: 'Failed to save company news' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    await requirePermission('news.manage');
  } catch {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const id = Number(searchParams.get('id'));
  if (!Number.isFinite(id)) {
    return NextResponse.json({ ok: false, error: 'Invalid news id' }, { status: 400 });
  }

  // SAFE: uses ? parameterized values, no user-input concatenation
  await prisma.$executeRawUnsafe('DELETE FROM CompanyNews WHERE id = ?', id);
  return NextResponse.json({ ok: true });
}
