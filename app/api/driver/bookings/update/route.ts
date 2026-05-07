import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email';
import { requireDriverByApiKey } from '@/lib/auth';
import { chargeSavedPaymentMethod } from '@/lib/payment-processor';
import { validateDriverApiOrigin } from '@/lib/security-headers';

const Schema = z.object({ id: z.number().int(), action: z.enum(['DELIVERED']) });

function emailTpl(subject: string, body: string) {
  return {
    subject,
    html: `<div style="font-family:Arial,Helvetica,sans-serif;line-height:1.6;color:#0f172a">
  <h2 style="margin:0 0 12px">${subject}</h2>
  <p>${body}</p>
  <p style="margin-top:16px;color:#475569;font-size:13px">944 Trafik<br/>Frederikssund - Phone: 26444944 - Email: trafik@944.dk</p>
</div>`,
  };
}

export async function POST(req: NextRequest) {
  const originCheck = validateDriverApiOrigin(req);
  if (!originCheck.ok) {
    console.warn('driver/bookings/update: invalid request origin', { reason: originCheck.reason });
    return NextResponse.json({ ok: false, error: 'Invalid request origin' }, { status: 403 });
  }

  let me;
  try {
    me = await requireDriverByApiKey(req);
  } catch (e: any) {
    console.warn('driver/bookings/update: driver authentication failed', { message: e?.message });
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: e?.status || 403 });
  }

  try {
    const { id, action } = Schema.parse(await req.json());

    if (!me) {
      return NextResponse.json({ ok: false, error: 'Driver not found' }, { status: 401 });
    }

    const ride = await prisma.ride.findUnique({
      where: { id },
      include: {
        user: true,
        invoices: {
          where: { status: 1 },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!ride) {
      return NextResponse.json({ ok: false, error: 'Ride not found' }, { status: 404 });
    }

    let updatedRide;
    let finalRideData;

    if (action === 'DELIVERED') {
      if (ride.driverId !== me.id) {
        console.warn('driver/bookings/update: access denied for ride delivery', {
          rideId: id,
          driverId: me.id,
        });
        return NextResponse.json(
          { ok: false, error: 'Access denied - you are not assigned to this ride' },
          { status: 403 }
        );
      }

      try {
        const rideWithPayment = await prisma.ride.findUnique({
          where: { id },
          include: {
            savedPaymentMethod: true,
            user: true,
          },
        });

        if (!rideWithPayment) {
          return NextResponse.json({ ok: false, error: 'Ride not found' }, { status: 404 });
        }

        if (!(rideWithPayment as any).savedPaymentMethod || rideWithPayment.paymentMethod !== 'card') {
          return NextResponse.json(
            { ok: false, error: 'No valid card payment method found for this ride' },
            { status: 400 }
          );
        }

        const paymentResult = await chargeSavedPaymentMethod({
          ...rideWithPayment,
          userpaymentmethod: (rideWithPayment as any).savedPaymentMethod,
        });

        if (!paymentResult.success) {
          const paymentError = paymentResult.error || 'Unknown payment error';
          const truncatedPaymentError =
            paymentError.length > 150 ? `${paymentError.substring(0, 150)}...` : paymentError;

          await prisma.ride.update({
            where: { id },
            data: {
              explanation: `Payment capture failed - ${truncatedPaymentError}`,
            },
          });

          console.warn('driver/bookings/update: payment capture failed', {
            rideId: id,
            driverId: me.id,
            message: paymentResult.error,
          });

          return NextResponse.json(
            { ok: false, error: `Payment capture failed: ${paymentResult.error}` },
            { status: 400 }
          );
        }

        updatedRide = await prisma.ride.update({
          where: { id },
          data: {
            status: 'COMPLETED',
            paymentStatus: 'PAID',
            explanation: 'Trip completed, passenger has been delivered',
          },
        });

        const invoiceNumber = `TUR-${id.toString().padStart(6, '0')}`;
        const invoiceDueDate = new Date();
        invoiceDueDate.setDate(invoiceDueDate.getDate() + 30);

        try {
          await prisma.invoice.create({
            data: {
              invoiceNumber,
              userId: rideWithPayment.userId,
              rideId: id,
              dueDate: invoiceDueDate,
              paymentStatus: 'PAID',
              status: 1,
              paymentMethod: 'card',
              paymentRef: paymentResult.transactionId,
              confirmedBy: me.id,
              confirmedAt: new Date(),
            },
          });
        } catch (invoiceError: any) {
          if (invoiceError.code === 'P2002') {
            const altInvoiceNumber = `TUR-${id.toString().padStart(6, '0')}-${Date.now()}`;
            try {
              await prisma.invoice.create({
                data: {
                  invoiceNumber: altInvoiceNumber,
                  userId: rideWithPayment.userId,
                  rideId: id,
                  dueDate: invoiceDueDate,
                  paymentStatus: 'PAID',
                  status: 1,
                  paymentMethod: 'card',
                  paymentRef: paymentResult.transactionId,
                  confirmedBy: me.id,
                  confirmedAt: new Date(),
                },
              });
            } catch (altError: any) {
              await prisma.ride.update({
                where: { id },
                data: {
                  explanation: 'Invoice creation failed - Database error',
                },
              });
              throw altError;
            }
          } else {
            await prisma.ride.update({
              where: { id },
              data: {
                explanation: 'Invoice creation failed - Duplicate invoice number',
              },
            });
            throw invoiceError;
          }
        }

        finalRideData = updatedRide;
        console.log('driver/bookings/update: ride delivered', { rideId: id, driverId: me.id });
      } catch (error: any) {
        console.error('driver/bookings/update: failed to complete delivered action', {
          message: error?.message,
          rideId: id,
          driverId: me.id,
        });

        const errorMessage = error?.message || 'General error in processing';
        const truncatedMessage =
          errorMessage.length > 150 ? `${errorMessage.substring(0, 150)}...` : errorMessage;

        await prisma.ride.update({
          where: { id },
          data: {
            explanation: `Ride delivery failed - ${truncatedMessage}`,
          },
        });

        return NextResponse.json({ ok: false, error: 'Failed to complete ride delivery' }, { status: 500 });
      }
    }

    const email = ride.user.email;

    try {
      if (action === 'DELIVERED') {
        const invoiceLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/account?tab=invoices`;
        const { subject, html } = emailTpl(
          'Thank you for choosing 944 Trafik!',
          `Your ride <b>#${ride.id}</b> has been completed successfully. Thank you for choosing 944 Trafik for your transportation needs. We hope to serve you again soon!<br/><br/>Your invoice has been generated and is available in your account: <a href="${invoiceLink}">View Invoice</a>`
        );
        await sendEmail(email, subject, html);
      }
    } catch (e) {
      console.warn('[mail] driver update email failed', e);
    }

    console.log('driver/bookings/update: success', { rideId: id, action, driverId: me.id });
    return NextResponse.json({
      ok: true,
      ride: finalRideData || updatedRide,
      message: 'Ride delivered and invoice created successfully',
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Invalid' }, { status: 400 });
  }
}
