import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email';
import { requireDriverByApiKey } from '@/lib/auth';
import { chargeSavedPaymentMethod } from '@/lib/payment-processor';
import { validateDriverApiOrigin } from '@/lib/security-headers';

const Schema = z.object({ id: z.number().int(), action: z.enum(['DELIVERED']) });

function emailTpl(subject:string, body:string){
  return { subject, html: `<div style="font-family:Arial,Helvetica,sans-serif;line-height:1.6;color:#0f172a">\n  <h2 style="margin:0 0 12px">${subject}</h2>\n  <p>${body}</p>\n  <p style="margin-top:16px;color:#475569;font-size:13px">— 944 Trafik<br/>Frederikssund — Phone: 26444944 — Email: trafik@944.dk</p>\n</div>` };
}

export async function POST(req: NextRequest){
  console.log(`📨 Driver booking update request received at ${new Date().toISOString()}`);
  const safeHeaderSnapshot = {
    origin: req.headers.get('origin') || null,
    referer: req.headers.get('referer') || null,
    userAgent: req.headers.get('user-agent') || null,
    contentType: req.headers.get('content-type') || null
  };
  console.log(`Request headers (safe):`, safeHeaderSnapshot);

  // Validate request origin for driver API
  const originCheck = validateDriverApiOrigin(req);
  if (!originCheck.ok) {
    console.log(`❌ Origin validation failed: ${originCheck.reason}`);
    const errorResponse = { ok: false, error: 'Invalid request origin' };
    console.log(`📤 Error response sent to driver server:`, errorResponse);
    return NextResponse.json(errorResponse, { status: 403 });
  }
  console.log(`✅ Origin validation passed`);

  let me;
  try{
    me = await requireDriverByApiKey(req);
    console.log(`✅ Driver authenticated: ${me.id} (${me.drUsername})`);
  }catch(e:any){
    console.log(`❌ Driver authentication failed: ${e.message}`);
    const errorResponse = { ok:false, error:'Forbidden' };
    console.log(`📤 Error response sent to driver server:`, errorResponse);
    return NextResponse.json(errorResponse, { status: e?.status||403 });
  }

  try{
    const { id, action } = Schema.parse(await req.json());

    if (!me) {
      const errorResponse = { ok:false, error:'Driver not found' };
      console.log(`📤 Error response sent to driver server:`, errorResponse);
      return NextResponse.json(errorResponse, { status: 401 });
    }

    // Enhanced ride fetch with related data
    console.log(`🔍 Fetching ride ${id} details`);
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

    if (!ride) {
      console.log(`❌ Ride ${id} not found`);
      const errorResponse = { ok:false, error:'Ride not found' };
      console.log(`📤 Error response sent to driver server:`, errorResponse);
      return NextResponse.json(errorResponse, { status:404 });
    }
    console.log(`✅ Ride ${id} found - status: ${ride.status}, driverId: ${ride.driverId}`);

    let data:any = {};
    let explanation = '';
    let updatedRide;
    let finalRideData;

    // Special handling for DELIVERED action (complete ride and capture payment)
    if (action==='DELIVERED') {
      // Security check: ensure the driver is assigned to this ride
      console.log(`🔍 Checking driver assignment: ride.driverId=${ride.driverId}, me.id=${me.id}`);
      if (ride.driverId !== me.id) {
        console.log(`❌ Access denied: driver ${me.id} not assigned to ride ${id} (assigned to ${ride.driverId})`);
        const errorResponse = { ok:false, error:'Access denied - you are not assigned to this ride' };
        console.log(`📤 Error response sent to driver server:`, errorResponse);
        return NextResponse.json(errorResponse, { status:403 });
      }

      console.log(`✅ Driver ${me.id} authorized for ride ${id}`);
      console.log(`🚚 Starting DELIVERED action for ride ${id} by driver ${me.id}`);
      try {
        // Step 1: Get ride with payment method info
        const rideWithPayment = await prisma.ride.findUnique({
          where: { id },
          include: {
            savedPaymentMethod: true,
            user: true
          }
        });

        if (!rideWithPayment) {
          console.log(`❌ Ride ${id} not found when fetching payment details`);
          const errorResponse = { ok:false, error:'Ride not found' };
          console.log(`📤 Error response sent to driver server:`, errorResponse);
          return NextResponse.json(errorResponse, { status:404 });
        }

        console.log(`✅ Ride ${id} payment details:`, {
          savedPaymentMethodId: rideWithPayment.savedPaymentMethodId,
          paymentMethod: rideWithPayment.paymentMethod,
          hasSavedPaymentMethod: !!(rideWithPayment as any).savedPaymentMethod,
          savedPaymentMethodProvider: (rideWithPayment as any).savedPaymentMethod?.provider
        });

        if (!(rideWithPayment as any).savedPaymentMethod || rideWithPayment.paymentMethod !== 'card') {
          console.log(`❌ Invalid payment method for ride ${id}:`, {
            hasPaymentMethod: !!(rideWithPayment as any).savedPaymentMethod,
            paymentMethod: rideWithPayment.paymentMethod
          });
          const errorResponse = { ok:false, error:'No valid card payment method found for this ride' };
          console.log(`📤 Error response sent to driver server:`, errorResponse);
          return NextResponse.json(errorResponse, { status:400 });
        }

        // Step 2: Capture payment on Stripe (change from authorized to captured)
        console.log(`💳 Capturing payment for ride ${id}`);
        const paymentResult = await chargeSavedPaymentMethod({
          ...rideWithPayment,
          userpaymentmethod: (rideWithPayment as any).savedPaymentMethod
        });

        if (!paymentResult.success) {
          console.error(`❌ Payment capture failed for ride ${id}:`, paymentResult.error);
          // Update explanation with failure reason
          const paymentError = paymentResult.error || 'Unknown payment error';
          const truncatedPaymentError = paymentError.length > 150
            ? paymentError.substring(0, 150) + '...'
            : paymentError;

          await prisma.ride.update({
            where: { id },
            data: {
              explanation: `Payment capture failed - ${truncatedPaymentError}`
            }
          });
          const errorResponse = {
            ok:false,
            error:`Payment capture failed: ${paymentResult.error}`
          };
          console.log(`📤 Error response sent to driver server:`, errorResponse);
          return NextResponse.json(errorResponse, { status:400 });
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
                  explanation: `Invoice creation failed - Database error`
                }
              });
              throw altError;
            }
          } else {
            // Update explanation with failure reason
            await prisma.ride.update({
              where: { id },
              data: {
                explanation: `Invoice creation failed - Duplicate invoice number`
              }
            });
            throw invoiceError;
          }
        }

        finalRideData = updatedRide;
        explanation = 'Trip completed, passenger has been delivered';

        console.log(`✅ DELIVERED action completed successfully for ride ${id} by driver`);

      } catch (error: any) {
        console.error('❌ Error processing DELIVERED action:', error);
        console.error('Error details:', {
          message: error?.message,
          stack: error?.stack,
          rideId: id,
          driverId: me.id
        });

        // Update explanation with failure reason (truncate to fit column)
        const errorMessage = error?.message || 'General error in processing';
        const truncatedMessage = errorMessage.length > 150
          ? errorMessage.substring(0, 150) + '...'
          : errorMessage;

        await prisma.ride.update({
          where: { id },
          data: {
            explanation: `Ride delivery failed - ${truncatedMessage}`
          }
        });
        const errorResponse = { ok:false, error:'Failed to complete ride delivery' };
        console.log(`📤 Error response sent to driver server:`, errorResponse);
        return NextResponse.json(errorResponse, { status:500 });
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

    console.log(`✅ Success response sent to driver server:`, { ok: true, message: 'Ride delivered and invoice created successfully' });
    return NextResponse.json({ ok:true, ride: finalRideData || updatedRide, message: 'Ride delivered and invoice created successfully' });
  }catch(e:any){
    const errorResponse = { ok:false, error: e?.message||'Invalid' };
    console.log(`📤 Error response sent to driver server:`, errorResponse);
    return NextResponse.json(errorResponse, { status:400 });
  }
}
