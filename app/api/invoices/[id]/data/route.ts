import { NextRequest, NextResponse } from 'next/server';
import { getUserFromCookie } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const me = await getUserFromCookie();
    if (!me) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const invoiceId = parseInt(params.id, 10);
    if (isNaN(invoiceId) || invoiceId <= 0) {
      return NextResponse.json({ error: 'Invalid invoice ID' }, { status: 400 });
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId }
    }) as any;

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    if (invoice.userId !== me.id && (me.type !== 'user' || (me as any).role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    const user = await prisma.user.findUnique({
      where: { id: invoice.userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        address: true,
      }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const ride = await prisma.ride.findUnique({
      where: { id: invoice.rideId },
      include: {
        vehicleType: {
          select: {
            title: true,
            capacity: true,
          }
        }
      }
    });

    if (!ride) {
      return NextResponse.json({ error: 'Ride not found' }, { status: 404 });
    }

    const completeInvoice = {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      paymentStatus: invoice.paymentStatus,
      status: invoice.status,
      dueDate: invoice.dueDate.toISOString(),
      createdAt: invoice.createdAt.toISOString(),
      updatedAt: (invoice.updatedAt ?? invoice.createdAt).toISOString(),
      lateFee1: invoice.lateFee1,
      lateFee2: invoice.lateFee2,
      lateFee1Date: invoice.lateFee1Date?.toISOString(),
      lateFee2Date: invoice.lateFee2Date?.toISOString(),
      extendedDueDate: invoice.extendedDueDate?.toISOString(),
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        address: user.address,
      },
      ride: {
        id: ride.id,
        pickupAddress: ride.pickupAddress,
        dropoffAddress: ride.dropoffAddress,
        pickupTime: ride.pickupTime.toISOString(),
        passengers: ride.passengers,
        price: ride.price,
        status: ride.status,
        paymentStatus: ride.paymentStatus,
        paymentMethod: ride.paymentMethod,
        vehicleType: {
          title: ride.vehicleType.title,
          capacity: ride.vehicleType.capacity,
        }
      }
    };

    return NextResponse.json({
      success: true,
      invoice: completeInvoice
    });
  } catch (error) {
    console.error('invoice/[id]/data failed:', error instanceof Error ? error.message : error);

    return NextResponse.json(
      {
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development'
          ? (error instanceof Error ? error.message : 'Unknown error')
          : undefined,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
