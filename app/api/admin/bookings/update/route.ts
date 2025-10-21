import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { sendEmail } from '@/lib/email'

const Schema = z.object({ id: z.number().int(), action: z.enum(['CONFIRM','DISPATCH','START','COMPLETE','CANCEL','MARK_PAID']) })

export async function POST(req: Request){
  try{
    const { id, action } = Schema.parse(await req.json())
    const ride = await prisma.ride.findUnique({ where:{ id }, include:{ user:true } })
    if (!ride) return NextResponse.json({ ok:false, error:'Ride not found' },{ status:404 })

    let data:any = {}
    if (action==='CONFIRM') data.status='CONFIRMED'
    if (action==='DISPATCH') data.status='DISPATCHED'
    if (action==='START') data.status='ONGOING'
    if (action==='COMPLETE') data.status='COMPLETED'
    if (action==='CANCEL') data.status='CANCELED'
    if (action==='MARK_PAID') data.paid=true

    const updated = await prisma.ride.update({ where:{ id }, data })

    // Email user on key actions
    const email = ride.user.email
    const fmt = new Date(ride.pickupTime).toLocaleString()
    try{
      if (action==='CONFIRM') await sendEmail(email,'Your booking is confirmed',`<p>Your ride #${ride.id} is confirmed for ${fmt}.</p>`)
      if (action==='DISPATCH') await sendEmail(email,'Your car is on the way',`<p>Your ride #${ride.id} has been dispatched. The car is on the way.</p>`)
      if (action==='COMPLETE') await sendEmail(email,'Your ride is completed',`<p>Your ride #${ride.id} is completed. Thank you!</p>`)
      if (action==='CANCEL') await sendEmail(email,'Your booking was canceled',`<p>Your ride #${ride.id} has been canceled.</p>`)
    }catch(e){ console.warn('[mail] admin update email failed', e) }

    return NextResponse.json({ ok:true, ride: updated })
  }catch(e:any){
    return NextResponse.json({ ok:false, error: e?.message||'Invalid' },{ status:400 })
  }
}
