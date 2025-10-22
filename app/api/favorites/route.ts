import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getUserFromCookie } from '@/lib/auth';

function bad(msg:string, code=400){ return NextResponse.json({ ok:false, error: msg }, { status: code }); }

export async function GET(){
  const me = await getUserFromCookie();
  if(!me) return bad('UNAUTHORIZED', 401);
  const items = await prisma.favoriteAddress.findMany({ where:{ userId: me.id }, orderBy:{ id: 'desc' } });
  return NextResponse.json({ ok:true, items });
}

export async function POST(req: Request){
  const me = await getUserFromCookie();
  if(!me) return bad('UNAUTHORIZED', 401);
  let body: any; try{ body = await req.json(); }catch{ return bad('INVALID_JSON'); }
  const label = (body?.label||'').toString().trim();
  const address = (body?.address||'').toString().trim();
  const lat = typeof body?.lat === 'number' ? body.lat : null;
  const lon = typeof body?.lon === 'number' ? body.lon : null;
  if(!label || !address) return bad('LABEL_AND_ADDRESS_REQUIRED');
  // امنع التكرار لنفس المستخدم بنفس العنوان
  const existing = await prisma.favoriteAddress.findFirst({ where:{ userId: me.id, address } });
  if(existing){ return NextResponse.json({ ok:true, item: existing, dedup: true }); }
  const item = await prisma.favoriteAddress.create({ data:{ userId: me.id, label, address, lat: lat ?? undefined, lon: lon ?? undefined } });
  return NextResponse.json({ ok:true, item });
}

export async function PATCH(req: Request){
  const me = await getUserFromCookie();
  if(!me) return bad('UNAUTHORIZED', 401);
  let body: any; try{ body = await req.json(); }catch{ return bad('INVALID_JSON'); }
  const id = Number(body?.id);
  if(!id) return bad('ID_REQUIRED');
  const row = await prisma.favoriteAddress.findUnique({ where:{ id } });
  if(!row || row.userId !== me.id) return bad('NOT_FOUND', 404);

  const data: any = {};
  if(typeof body.label === 'string'){ data.label = body.label.trim(); }
  if(typeof body.address === 'string'){ const addr = body.address.trim(); if(!addr) return bad('ADDRESS_EMPTY'); data.address = addr; }
  if('lat' in body){ data.lat = (typeof body.lat === 'number')? body.lat : null; }
  if('lon' in body){ data.lon = (typeof body.lon === 'number')? body.lon : null; }

  // منع تكرار العنوان عند التعديل
  if(data.address){
    const dup = await prisma.favoriteAddress.findFirst({ where:{ userId: me.id, address: data.address, NOT: { id } } });
    if(dup) return bad('DUPLICATE_ADDRESS');
  }

  const item = await prisma.favoriteAddress.update({ where:{ id }, data });
  return NextResponse.json({ ok:true, item });
}

export async function DELETE(req: Request){
  const me = await getUserFromCookie();
  if(!me) return bad('UNAUTHORIZED', 401);
  const { searchParams } = new URL(req.url);
  const id = Number(searchParams.get('id'));
  if(!id) return bad('ID_REQUIRED');
  const row = await prisma.favoriteAddress.findUnique({ where:{ id } });
  if(!row || row.userId !== me.id) return bad('NOT_FOUND', 404);
  await prisma.favoriteAddress.delete({ where:{ id } });
  return NextResponse.json({ ok:true });
}
