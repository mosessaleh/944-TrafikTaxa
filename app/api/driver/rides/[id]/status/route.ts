import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { verify } from 'jsonwebtoken';
import { chargeSavedPaymentMethod, PaymentResult } from '@/lib/payment-processor';
import { notifyUserInvoiceReady } from '@/lib/notify';
import { getSocketServer } from '@/lib/socket-server';
import { getAuthSecret } from '@/lib/auth';

const JWT_SECRET = getAuthSecret();

const UpdateStatusSchema = z.object({
  status: z.enum(['PICKED_UP', 'COMPLETED']),
  pickedAt: z.string().optional(),
  droppedAt: z.string().optional(),
  droppedOnLocation: z.array(z.number()).optional(), // [lat, lon]
});

const allowedStatusTransitions: Record<string, string[]> = {
  DISPATCHED: ['PICKED_UP'],
  ONGOING: ['PICKED_UP'],
  PICKED_UP: ['COMPLETED'],
  IN_PROGRESS: ['COMPLETED']
};

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const rideId = parseInt(params.id);
    if (isNaN(rideId)) {
      return NextResponse.json({ ok: false, error: 'Invalid ride ID' }, { status: 400 });
    }

    const body = await req.json();
    const { status, pickedAt, droppedAt, droppedOnLocation } = UpdateStatusSchema.parse(body);

    let paymentResult: PaymentResult | null = null;

    console.log('PUT /api/driver/rides/[id]/status called for rideId:', rideId, 'status:', status);

    // Verify the driver token
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.substring(7);

    let driver;
    try {
      const decoded: any = verify(
        token,
        JWT_SECRET
      );

      if (!decoded.driverId || decoded.type !== 'driver') {
        return NextResponse.json({ ok: false, error: 'Invalid token' }, { status: 401 });
      }

      driver = await prisma.comDriver.findUnique({
        where: { id: decoded.driverId },
      });

      if (!driver) {
        return NextResponse.json({ ok: false, error: 'Driver not found' }, { status: 404 });
      }

      console.log('Driver authenticated:', driver.id);
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

    const currentStatus = String(ride.status || '').toUpperCase();
    const requestedStatus = String(status || '').toUpperCase();
    const allowedNext = allowedStatusTransitions[currentStatus] || [];
    if (!allowedNext.includes(requestedStatus)) {
      return NextResponse.json(
        {
          ok: false,
          error: `Invalid status transition from ${currentStatus} to ${requestedStatus}`
        },
        { status: 400 }
      );
    }

    // Update the ride status
    const updateData: any = { status };
    if (status === 'PICKED_UP' && pickedAt) {
      updateData.pickedAt = new Date(pickedAt);
    } else if (status === 'COMPLETED' && droppedAt) {
      updateData.droppedAt = new Date(droppedAt);
      if (droppedOnLocation) {
        updateData.droppedOnLocation = droppedOnLocation;
      }
    }

    await prisma.ride.update({
      where: { id: rideId },
      data: updateData,
    });

    if (status === 'PICKED_UP' || status === 'COMPLETED') {
      const proximityMap = (global as any).pickupProximitySent as Map<string, any> | undefined;
      const lateWarningMap = (global as any).scheduledLateWarnings as Map<string, any> | undefined;
      const proximityKey = `${rideId}_${driver.id}`;
      if (proximityMap?.delete) {
        proximityMap.delete(proximityKey);
      }
      if (lateWarningMap?.delete) {
        lateWarningMap.delete(proximityKey);
      }
    }

    // Notify driver via socket
    const io = (global as any).io;
    if (io) {
      io.to(`driver_${driver.id}`).emit('ride-update', {
        rideId: rideId,
        status: status,
        timestamp: new Date().toISOString()
      });

      // Notify passenger of booking update
      io.to(`booking_${rideId}`).emit('bookingUpdate', {
        bookingId: rideId,
        status: status,
        timestamp: new Date().toISOString()
      });
    }

    // If completed, update driver status
    if (status === 'COMPLETED') {
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
    }

    // Create invoice if ride is completed
    if (status === 'COMPLETED') {
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
            paymentAmount: ride.price,
          }
        });

        // Notify user that invoice is ready
        if (ride.user.email) {
          try {
            await notifyUserInvoiceReady(ride.user.email, ride.user.firstName, {
              bookingId: ride.id,
              price: Number(ride.price).toFixed(2)
            }, invoice.id);
          } catch (notifyError) {
            console.error('Failed to notify user about invoice:', notifyError);
          }
        }

        console.log(`✅ Invoice created for ride ${rideId}: ${invoiceNumber}`);
      } catch (invoiceError: any) {
        console.error(`❌ Failed to create invoice for ride ${rideId}:`, invoiceError);
      }
    }

    return NextResponse.json({
      ok: true,
      message: `Ride status updated to ${status}`,
      paymentResult: paymentResult ? {
        success: paymentResult.success,
        transactionId: paymentResult.transactionId,
        error: paymentResult.error
      } : null,
    });

  } catch (e: any) {
    console.error('Error updating ride status:', e);
    return NextResponse.json({ ok: false, error: e?.message || 'Invalid request' }, { status: 400 });
  }
}
