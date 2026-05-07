import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';
import { ensureDevelopmentOnly } from '@/lib/dev-route';

export async function GET(){
  const blocked = ensureDevelopmentOnly();
  if (blocked) return blocked;

  try{
    const u = await getCurrentUser();
    if(!u) return NextResponse.json({ ok:false }, { status:401 });
    return NextResponse.json({ ok:true, user:u });
  }catch(e:any){
    return NextResponse.json({ ok:false, error: e?.message||'failed' }, { status:500 });
  }
}
