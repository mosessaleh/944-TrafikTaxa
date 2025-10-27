import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getUserFromCookie } from '@/lib/auth';
import { sanitizeInput } from '@/lib/sanitize';
import { limitOrThrow, clientIpKey } from '@/lib/rate-limit';

function bad(msg: string, code = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status: code });
}

export async function GET(req: Request) {
  try {
    await limitOrThrow('favorites:' + clientIpKey(req), { points: 30, durationSec: 60 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: 'Too many requests, try again later.' }, { status: e?.status || 429 });
  }

  const me = await getUserFromCookie();
  if (!me) return bad('UNAUTHORIZED', 401);
  const items = await prisma.favoriteAddress.findMany({ where: { userId: me.id }, orderBy: { id: 'desc' } });
  return NextResponse.json({ ok: true, items });
}

export async function POST(req: Request) {
  try {
    await limitOrThrow('favorites:' + clientIpKey(req), { points: 10, durationSec: 60 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: 'Too many requests, try again later.' }, { status: e?.status || 429 });
  }

  const me = await getUserFromCookie();
  if (!me) return bad('UNAUTHORIZED', 401);
  let body: any;
  try {
    body = await req.json();
  } catch {
    return bad('INVALID_JSON');
  }

  // Sanitize inputs
  const label = sanitizeInput(body?.label, 'text')?.slice(0, 100) || '';
  const address = sanitizeInput(body?.address, 'address')?.slice(0, 500) || '';
  const lat = (typeof body?.lat === 'number' && body.lat >= -90 && body.lat <= 90) ? body.lat : null;
  const lon = (typeof body?.lon === 'number' && body.lon >= -180 && body.lon <= 180) ? body.lon : null;

  if (!label || !address) return bad('LABEL_AND_ADDRESS_REQUIRED');

  // Validate label and address length and content
  if (label.length < 2 || label.length > 100) return bad('INVALID_LABEL_LENGTH');
  if (address.length < 3 || address.length > 500) return bad('INVALID_ADDRESS_LENGTH');

  // Prevent duplicates for same user with same address
  const existing = await prisma.favoriteAddress.findFirst({ where: { userId: me.id, address } });
  if (existing) {
    return NextResponse.json({ ok: true, item: existing, dedup: true });
  }

  const item = await prisma.favoriteAddress.create({
    data: { userId: me.id, label, address, lat: lat ?? undefined, lon: lon ?? undefined }
  });
  return NextResponse.json({ ok: true, item });
}

export async function PATCH(req: Request) {
  try {
    await limitOrThrow('favorites:' + clientIpKey(req), { points: 10, durationSec: 60 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: 'Too many requests, try again later.' }, { status: e?.status || 429 });
  }

  const me = await getUserFromCookie();
  if (!me) return bad('UNAUTHORIZED', 401);
  let body: any;
  try {
    body = await req.json();
  } catch {
    return bad('INVALID_JSON');
  }
  const id = Number(body?.id);
  if (!id || isNaN(id) || id <= 0) return bad('ID_REQUIRED');
  const row = await prisma.favoriteAddress.findUnique({ where: { id } });
  if (!row || row.userId !== me.id) return bad('NOT_FOUND', 404);

  const data: any = {};
  if (typeof body.label === 'string') {
    const sanitizedLabel = sanitizeInput(body.label, 'text')?.slice(0, 100);
    if (sanitizedLabel && sanitizedLabel.length >= 2) data.label = sanitizedLabel;
  }
  if (typeof body.address === 'string') {
    const addr = sanitizeInput(body.address, 'address')?.slice(0, 500);
    if (!addr || addr.length < 3) return bad('ADDRESS_EMPTY');
    data.address = addr;
  }
  if ('lat' in body) {
    const lat = (typeof body.lat === 'number' && body.lat >= -90 && body.lat <= 90) ? body.lat : null;
    data.lat = lat;
  }
  if ('lon' in body) {
    const lon = (typeof body.lon === 'number' && body.lon >= -180 && body.lon <= 180) ? body.lon : null;
    data.lon = lon;
  }

  // Prevent duplicate addresses when editing
  if (data.address) {
    const dup = await prisma.favoriteAddress.findFirst({ where: { userId: me.id, address: data.address, NOT: { id } } });
    if (dup) return bad('DUPLICATE_ADDRESS');
  }

  const item = await prisma.favoriteAddress.update({ where: { id }, data });
  return NextResponse.json({ ok: true, item });
}

export async function DELETE(req: Request) {
  try {
    await limitOrThrow('favorites:' + clientIpKey(req), { points: 10, durationSec: 60 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: 'Too many requests, try again later.' }, { status: e?.status || 429 });
  }

  const me = await getUserFromCookie();
  if (!me) return bad('UNAUTHORIZED', 401);
  const { searchParams } = new URL(req.url);
  const id = Number(searchParams.get('id'));
  if (!id || isNaN(id) || id <= 0) return bad('ID_REQUIRED');
  const row = await prisma.favoriteAddress.findUnique({ where: { id } });
  if (!row || row.userId !== me.id) return bad('NOT_FOUND', 404);
  await prisma.favoriteAddress.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}