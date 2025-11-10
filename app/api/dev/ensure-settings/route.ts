import { NextResponse } from 'next/server';
import { getSettingsForAdmin } from '@/lib/price';

export async function GET(){
  try{
    const s = await getSettingsForAdmin();
    return NextResponse.json({ ok:true, settings: s });
  }catch(e:any){
    return NextResponse.json({ ok:false, error: e?.message || 'Failed' }, { status:500 });
  }
}
