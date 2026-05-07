import { NextResponse } from 'next/server';
import { getSettingsForAdmin } from '@/lib/price';
import { ensureDevelopmentOnly } from '@/lib/dev-route';

export async function GET(){
  const blocked = ensureDevelopmentOnly();
  if (blocked) return blocked;

  try{
    const s = await getSettingsForAdmin();
    return NextResponse.json({ ok:true, settings: s });
  }catch(e:any){
    return NextResponse.json({ ok:false, error: e?.message || 'Failed' }, { status:500 });
  }
}
