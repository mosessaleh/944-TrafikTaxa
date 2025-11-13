import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email';
import { requireAdmin, getUserFromCookie } from '@/lib/auth';

const Schema = z.object({ id: z.number().int(), action: z.enum(['CONFIRM','DISPATCH','START','COMPLETE','CANCEL','MARK_PAID','PROCESS','CONFIRM_BOOKING','REFUNDING','REFUNDED']) });

function emailTpl(subject:string, body:string){
  return { subject, html: `<div style="font-family:Arial,Helvetica,sans-serif;line-height:1.6;color:#0f172a">\n  <h2 style="margin:0 0 12px">${subject}</h2>\n  <p>${body}</p>\n  <p style="margin-top:16px;color:#475569;font-size:13px">— 944 Trafik<br/>Frederikssund — Phone: 26444944 — Email: trafik@944.dk</p>\n</div>` };
}

export async function POST(req: NextRequest){
  try{ await requireAdmin(); }catch(e:any){ return NextResponse.json({ ok:false, error:'Forbidden' }, { status: e?.status||403 }); }
  
  try{
    const { id, action } = Schema.parse(await req.json());
    const me = await getUserFromCookie();
    
    if (!me) {
      return NextResponse.json({ ok:false, error:'Admin not found' }, { status: 401 });
    }

    // Enhanced ride fetch with related data
    const ride = await prisma.ride.findUnique({
      where:{ id },
      include:{
        user: true,
        invoices: {
          where: {
            status: 1 // Only active invoices
          },
          orderBy: {
            createdAt: 'desc'
          },
          take: 1
        }
      }
    });
    
    if (!ride) return NextResponse.json({ ok:false, error:'Ride not found' },{ status:404 });

    let data:any = {};
    let explanation = '';
    let updatedRide;

    // Special handling for MARK_PAID action
    if (action==='MARK_PAID') {
      try {
        updatedRide = await prisma.$transaction(async (tx) => {
          // Update ride payment status and confirmation
          updatedRide = await tx.ride.update({
            where: { id },
            data: {
              paymentStatus: 'PAID',
              status: 'CONFIRMED',
              explanation: 'Payment confirmed by admin and booking confirmed',
              paymentMethod: 'admin_confirmed'
            }
          });

          // Check if invoice exists, if not create one
          let invoice = ride.invoices?.[0];
          
          if (!invoice) {
            // Create new invoice for this booking (simple receipt)
            // Format: TUR-000045 (6 digits with leading zeros)
            const invoiceNumber = `TUR-${id.toString().padStart(6, '0')}`;
            
            // Check if invoice number already exists
            const existingInvoice = await tx.invoice.findUnique({
              where: { invoiceNumber: invoiceNumber }
            });
            
            if (existingInvoice) {
              throw new Error(`Invoice number ${invoiceNumber} already exists`);
            }
            
            const createdAt = new Date();
            
            invoice = await tx.invoice.create({
              data: {
                invoiceNumber: invoiceNumber,
                userId: ride.userId,
                rideId: ride.id,
                createdAt: createdAt,
                dueDate: createdAt, // Same as createdAt since it's a receipt, not a bill
                status: 1, // Active
                paymentStatus: 'PAID',
                updatedAt: new Date()
              }
            });
            console.log(`Created new invoice ${invoice.id} with number: ${invoiceNumber}`);
          } else if (invoice.paymentStatus !== 'PAID') {
            // Update existing invoice to mark as paid
            invoice = await tx.invoice.update({
              where: { id: invoice.id },
              data: {
                paymentStatus: 'PAID',
                updatedAt: new Date()
              }
            });
            console.log(`Updated existing invoice ${invoice.id} to PAID`);
          }
          
          return { updatedRide, invoice };
        });
        
        explanation = 'Payment confirmed by admin and booking confirmed - Invoice created/updated';
        data = {
          paymentStatus: 'PAID',
          status: 'CONFIRMED',
          explanation: explanation,
          paymentMethod: 'admin_confirmed'
        };
      } catch (error) {
        console.error('Error processing MARK_PAID action:', error);
        return NextResponse.json({ ok:false, error:'Failed to process payment confirmation' }, { status:500 });
      }
    } else {
      // Standard actions
      if (action==='CONFIRM') {
        data.status='CONFIRMED';
        explanation = 'Waiting for car dispatch';
      }
      if (action==='DISPATCH') {
        data.status='DISPATCHED';
        explanation = 'Car is on the way';
      }
      if (action==='START') {
        data.status='ONGOING';
        explanation = 'Waiting for passenger pickup';
      }
      if (action==='COMPLETE') {
        data.status='COMPLETED';
        explanation = 'Ride completed successfully';
      }
      if (action==='CANCEL') {
        data.status='CANCELED';
        explanation = 'Ride has been canceled';
      }
      if (action==='PROCESS') {
        data.status='PROGRESSING';
        explanation = 'Booking is being processed';
      }
      if (action==='CONFIRM_BOOKING') {
        data.status='CONFIRMED';
        explanation = 'Waiting for car dispatch';
      }
      if (action==='REFUNDING') {
        data.status='REFUNDING';
        explanation = 'Refund in progress';
      }
      if (action==='REFUNDED') {
        data.status='REFUNDED';
        explanation = 'Refund completed';
      }

      if (explanation) data.explanation = explanation;
      updatedRide = await prisma.ride.update({ where:{ id }, data });
    }

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
      if (action==='REFUNDING'){
        const { subject, html } = emailTpl('Refund in progress', `We are processing a refund for your ride <b>#${ride.id}</b>. The refund will be completed within 3-5 business days.`);
        await sendEmail(email, subject, html);
      }
      if (action==='REFUNDED'){
        const { subject, html } = emailTpl('Refund completed', `Your refund for ride <b>#${ride.id}</b> has been processed successfully. The amount has been credited back to your original payment method.`);
        await sendEmail(email, subject, html);
      }
    }catch(e){ console.warn('[mail] admin update email failed', e); }

    return NextResponse.json({ ok:true, ride: updatedRide });
  }catch(e:any){
    return NextResponse.json({ ok:false, error: e?.message||'Invalid' },{ status:400 });
  }
}
