import { NextResponse } from 'next/server';
import { z } from 'zod';

const QuerySchema = z.object({
  search: z.string().regex(/^\d{8}$/, 'CVR must be exactly 8 digits'),
});

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const search = url.searchParams.get('search');

    const parsed = QuerySchema.safeParse({ search });
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: 'Invalid CVR format' }, { status: 400 });
    }

    const response = await fetch(`https://cvrapi.dk/api?search=${search}&country=dk`);
    if (!response.ok) {
      throw new Error('Failed to fetch from CVR API');
    }

    const data = await response.json();
    return NextResponse.json({ ok: true, data });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Failed to fetch CVR data' }, { status: 500 });
  }
}