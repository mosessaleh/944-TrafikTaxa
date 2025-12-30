import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verify } from 'jsonwebtoken';
import { chargeSavedPaymentMethod, PaymentResult } from '@/lib/payment-processor';
import { notifyUserInvoiceReady } from '@/lib/notify';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const rideId = parseInt(params.id);
    if (isNaN(rideId)) {
      return NextResponse.json({ ok: false, error: 'Invalid ride ID' }, { status: 400 });
    }

    // Verify the driver token
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.substring(7);

    let driver;
    try {
      const decoded: any = verify(token, process.env.AUTH_SECRET || 'change_me_dev_secret');

      if (!decoded.driverId || decoded.type !== 'driver') {
        return NextResponse.json({ ok: false, error: 'Invalid token' }, { status: 401 });
      }

      driver = await prisma.comDriver.findUnique({
        where: { id: decoded.driverId },
      });

      if (!driver) {
        return NextResponse.json({ ok: false, error: 'Driver not found' }, { status: 404 });
      }
    } catch (error) {
      return NextResponse.json({ ok: false, error: 'Invalid or expired token' }, { status: 401 });
    }

    // Check if ride exists and is assigned to this driver
    const ride = await prisma.ride.findUnique({
      where: { id: rideId },
      include: {
        savedPaymentMethod: true,
        user: true
      }
    });

    if (!ride) {
      return NextResponse.json({ ok: false, error: 'Ride not found' }, { status: 404 });
    }

    if (ride.driverId !== driver.id) {
      return NextResponse.json({ ok: false, error: 'Ride not assigned to this driver' }, { status: 403 });
    }

    if (ride.status !== 'IN_PROGRESS') {
      return NextResponse.json({ ok: false, error: 'Ride is not in progress' }, { status: 400 });
    }

    let paymentResult: PaymentResult | null = null;

    // Update ride status to COMPLETED
    await prisma.ride.update({
      where: { id: rideId },
      data: {
        status: 'COMPLETED',
        droppedAt: new Date()
      }
    });

    // Update driver status
    await prisma.comDriver.update({
      where: { id: driver.id },
      data: {
        currentRideId: null,
        rideAccepted: 0,
        isBusy: false,
      },
    });

    // Handle payment based on method
    if (ride.savedPaymentMethodId) {
      console.log(`Processing immediate payment for completed ride ${rideId} with saved payment method ${ride.savedPaymentMethodId}`);
      try {
        paymentResult = await chargeSavedPaymentMethod(ride);
        if (paymentResult.success) {
          console.log(`✅ Immediate payment successful for ride ${rideId}, transaction: ${paymentResult.transactionId}`);
        } else {
          console.log(`❌ Immediate payment failed for ride ${rideId}: ${paymentResult.error}`);
        }
      } catch (paymentError: any) {
        console.error(`💥 Exception during immediate payment for ride ${rideId}:`, paymentError);
        paymentResult = { success: false, error: paymentError.message };
      }
    } else if (ride.paymentMethod === 'cash') {
      // For cash payments, mark as paid since driver collects payment
      await prisma.ride.update({
        where: { id: rideId },
        data: {
          paymentStatus: 'PAID',
          explanation: 'Payment collected in cash by driver'
        }
      });
      console.log(`✅ Cash payment marked as collected for ride ${rideId}`);
    } else {
      console.log(`No payment method configured for ride ${rideId}, paymentMethod: ${ride.paymentMethod}, savedPaymentMethodId: ${ride.savedPaymentMethodId}`);
    }

    // Create invoice
    try {
      const invoiceNumber = `INV-${rideId}-${Date.now()}`;
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 14); // 14 days payment term

      const invoice = await prisma.invoice.create({
        data: {
          invoiceNumber,
          userId: ride.userId,
          rideId: ride.id,
          dueDate,
          paymentStatus: paymentResult?.success ? 'PAID' : 'UNPAID',
          paymentMethod: ride.paymentMethod || 'card',
          paymentRef: paymentResult?.transactionId,
          paymentDate: paymentResult?.success ? new Date() : null,
          paymentAmount: ride.price / 100, // Convert from øre to DKK
        }
      });

      // Notify user that invoice is ready
      if (ride.user.email) {
        try {
          await notifyUserInvoiceReady(ride.user.email, ride.user.firstName, {
            bookingId: ride.id,
            price: (ride.price / 100).toFixed(2)
          }, invoice.id);
        } catch (notifyError) {
          console.error('Failed to notify user about invoice:', notifyError);
        }
      }

      console.log(`✅ Invoice created for ride ${rideId}: ${invoiceNumber}`);
    } catch (invoiceError: any) {
      console.error(`❌ Failed to create invoice for ride ${rideId}:`, invoiceError);
    }

    return NextResponse.json({
      ok: true,
      message: 'Ride completed successfully',
      paymentResult: paymentResult ? {
        success: paymentResult.success,
        transactionId: paymentResult.transactionId,
        error: paymentResult.error
      } : null,
    });

  } catch (e: any) {
    console.error('Error completing ride:', e);
    return NextResponse.json({ ok: false, error: e?.message || 'Invalid request' }, { status: 400 });
  }
}