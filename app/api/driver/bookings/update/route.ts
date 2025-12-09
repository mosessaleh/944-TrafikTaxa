import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email';
import { requireDriverByApiKey } from '@/lib/auth';
import { chargeSavedPaymentMethod } from '@/lib/payment-processor';

const Schema = z.object({ id: z.number().int(), action: z.enum(['DELIVERED']) });

function emailTpl(subject:string, body:string){
  return { subject, html: `<div style="font-family:Arial,Helvetica,sans-serif;line-height:1.6;color:#0f172a">\n  <h2 style="margin:0 0 12px">${subject}</h2>\n  <p>${body}</p>\n  <p style="margin-top:16px;color:#475569;font-size:13px">— 944 Trafik<br/>Frederikssund — Phone: 26444944 — Email: trafik@944.dk</p>\n</div>` };
}

export async function POST(req: NextRequest){
  try{ await requireDriverByApiKey(req); }catch(e:any){ return NextResponse.json({ ok:false, error:'Forbidden' }, { status: e?.status||403 }); }

  try{
    const { id, action } = Schema.parse(await req.json());
    const me = await requireDriverByApiKey(req);

    if (!me) {
      return NextResponse.json({ ok:false, error:'Driver not found' }, { status: 401 });
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
    let finalRideData;

    // Special handling for DELIVERED action (complete ride and capture payment)
    if (action==='DELIVERED') {
      console.log(`🚚 Starting DELIVERED action for ride ${id} by driver`);
      try {
        // Step 1: Get ride with payment method info
        const rideWithPayment = await prisma.ride.findUnique({
          where: { id },
          include: {
            userpaymentmethod: true,
            user: true
          }
        });

        if (!rideWithPayment) {
          return NextResponse.json({ ok:false, error:'Ride not found' }, { status:404 });
        }

        if (!rideWithPayment.userpaymentmethod || rideWithPayment.paymentMethod !== 'card') {
          return NextResponse.json({ ok:false, error:'No valid card payment method found for this ride' }, { status:400 });
        }

        // Step 2: Capture payment on Stripe (change from authorized to captured)
        console.log(`💳 Capturing payment for ride ${id}`);
        const paymentResult = await chargeSavedPaymentMethod(rideWithPayment);

        if (!paymentResult.success) {
          console.error(`❌ Payment capture failed for ride ${id}:`, paymentResult.error);
          // Update explanation with failure reason
          await prisma.ride.update({
            where: { id },
            data: {
              explanation: `Payment capture failed - ${paymentResult.error}`
            }
          });
          return NextResponse.json({
            ok:false,
            error:`Payment capture failed: ${paymentResult.error}`
          }, { status:400 });
        }

        console.log(`✅ Payment captured successfully for ride ${id}, transaction: ${paymentResult.transactionId}`);

        // Step 3: Update ride status after successful payment
        const updatedRide = await prisma.ride.update({
          where: { id },
          data: {
            status: 'COMPLETED',
            paymentStatus: 'PAID',
            explanation: 'Trip completed, passenger has been delivered'
          }
        });

        // Step 4: Create invoice
        const invoiceNumber = `TUR-${id.toString().padStart(6, '0')}`;
        console.log(`📄 Creating invoice ${invoiceNumber} for ride ${id}`);

        const invoiceDueDate = new Date();
        invoiceDueDate.setDate(invoiceDueDate.getDate() + 30);

        let invoice;
        try {
          invoice = await prisma.invoice.create({
            data: {
              invoiceNumber,
              userId: rideWithPayment.userId,
              rideId: id,
              dueDate: invoiceDueDate,
              paymentStatus: 'PAID',
              status: 1, // Active
              paymentMethod: 'card',
              paymentRef: paymentResult.transactionId,
              confirmedBy: me.id, // Driver ID
              confirmedAt: new Date()
            }
          });
          console.log(`✅ Invoice created: ${invoiceNumber}`);
        } catch (invoiceError: any) {
          if (invoiceError.code === 'P2002') {
            const altInvoiceNumber = `TUR-${id.toString().padStart(6, '0')}-${Date.now()}`;
            try {
              invoice = await prisma.invoice.create({
                data: {
                  invoiceNumber: altInvoiceNumber,
                  userId: rideWithPayment.userId,
                  rideId: id,
                  dueDate: invoiceDueDate,
                  paymentStatus: 'PAID',
                  status: 1, // Active
                  paymentMethod: 'card',
                  paymentRef: paymentResult.transactionId,
                  confirmedBy: me.id,
                  confirmedAt: new Date()
                }
              });
              console.log(`✅ Invoice created with alternative number: ${altInvoiceNumber}`);
            } catch (altError: any) {
              // Update explanation with failure reason
              await prisma.ride.update({
                where: { id },
                data: {
                  explanation: `Invoice creation failed - Error creating invoice in invoices table`
                }
              });
              throw altError;
            }
          } else {
            // Update explanation with failure reason
            await prisma.ride.update({
              where: { id },
              data: {
                explanation: `Invoice creation failed - Duplicate invoice number in invoices table`
              }
            });
            throw invoiceError;
          }
        }

        finalRideData = updatedRide;
        explanation = 'Trip completed, passenger has been delivered';

        console.log(`✅ DELIVERED action completed successfully for ride ${id} by driver`);

      } catch (error) {
        console.error('Error processing DELIVERED action:', error);
        // Update explanation with failure reason
        await prisma.ride.update({
          where: { id },
          data: {
            explanation: `Ride delivery failed - General error in processing`
          }
        });
        return NextResponse.json({ ok:false, error:'Failed to complete ride delivery' }, { status:500 });
      }
    }

    const email = ride.user.email;

    try{
      if (action==='DELIVERED'){
        const invoiceLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/account?tab=invoices`;
        const { subject, html } = emailTpl('Thank you for choosing 944 Trafik!', `Your ride <b>#${ride.id}</b> has been completed successfully. Thank you for choosing 944 Trafik for your transportation needs. We hope to serve you again soon!<br/><br/>Your invoice has been generated and is available in your account: <a href="${invoiceLink}">View Invoice</a>`);
        await sendEmail(email, subject, html);
      }
    }catch(e){ console.warn('[mail] driver update email failed', e); }

    return NextResponse.json({ ok:true, ride: finalRideData || updatedRide, message: 'Ride delivered and invoice created successfully' });
  }catch(e:any){
    return NextResponse.json({ ok:false, error: e?.message||'Invalid' },{ status:400 });
  }
}