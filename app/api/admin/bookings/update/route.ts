import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email';
import { requireAdmin } from '@/lib/auth';

const Schema = z.object({ id: z.number().int(), action: z.enum(['CONFIRM','DISPATCH','START','COMPLETE','CANCEL','MARK_PAID','PROCESS','CONFIRM_BOOKING']) });

function emailTpl(subject:string, body:string){
  return { subject, html: `<div style="font-family:Arial,Helvetica,sans-serif;line-height:1.6;color:#0f172a">\n  <h2 style="margin:0 0 12px">${subject}</h2>\n  <p>${body}</p>\n  <p style="margin-top:16px;color:#475569;font-size:13px">— 944 Trafik<br/>Frederikssund — Phone: 26444944 — Email: trafik@944.dk</p>\n</div>` };
}

export async function POST(req: Request){
  try{ await requireAdmin(); }catch(e:any){ return NextResponse.json({ ok:false, error:'Forbidden' }, { status: e?.status||403 }); }
  try{
    const { id, action } = Schema.parse(await req.json());
    const ride = await prisma.ride.findUnique({ where:{ id }, include:{ user:true } });
    if (!ride) return NextResponse.json({ ok:false, error:'Ride not found' },{ status:404 });

    let data:any = {};
    if (action==='CONFIRM') data.status='CONFIRMED';
    if (action==='DISPATCH') data.status='DISPATCHED';
    if (action==='START') data.status='ONGOING';
    if (action==='COMPLETE') data.status='COMPLETED';
    if (action==='CANCEL') data.status='CANCELED';
    if (action==='MARK_PAID') data.paid=true;
    if (action==='PROCESS') data.status='PROGRESSING';
    if (action==='CONFIRM_BOOKING') data.status='CONFIRMED';

    const updated = await prisma.ride.update({ where:{ id }, data });

    const email = ride.user.email;
    const when = new Date(ride.pickupTime).toLocaleString();
    try{
      if (action==='CONFIRM'){
        const { subject, html } = emailTpl('Your booking is confirmed', `We have confirmed your ride <b>#${ride.id}</b> scheduled for <b>${when}</b>.<br/>You will be notified once a car is dispatched.`);
        await sendEmail(email, subject, html);
      }
      if (action==='DISPATCH'){
        const { subject, html } = emailTpl('Your car is on the way', `A car has been dispatched for your ride <b>#${ride.id}</b>. The driver will arrive as soon as possible.`);
        await sendEmail(email, subject, html);
      }
      if (action==='COMPLETE'){
        const { subject, html } = emailTpl('Your ride is completed', `Your ride <b>#${ride.id}</b> has been completed. Thank you for choosing 944 Trafik.`);
        await sendEmail(email, subject, html);
      }
      if (action==='CANCEL'){
        const { subject, html } = emailTpl('Your booking was canceled', `Your ride <b>#${ride.id}</b> has been canceled. If this was a mistake, you can book a new ride anytime.`);
        await sendEmail(email, subject, html);
      }
      if (action==='PROCESS'){
        const { subject, html } = emailTpl('Your booking is being processed', `We are now processing your ride <b>#${ride.id}</b> scheduled for <b>${when}</b>.<br/>You will be notified once it is confirmed.`);
        await sendEmail(email, subject, html);
      }
      if (action==='CONFIRM_BOOKING'){
        const { subject, html } = emailTpl('Your booking is confirmed', `We have confirmed your ride <b>#${ride.id}</b> scheduled for <b>${when}</b>.<br/>You will be notified once a car is dispatched.`);
        await sendEmail(email, subject, html);
      }
    }catch(e){ console.warn('[mail] admin update email failed', e); }

    return NextResponse.json({ ok:true, ride: updated });
  }catch(e:any){
    return NextResponse.json({ ok:false, error: e?.message||'Invalid' },{ status:400 });
  }
}
