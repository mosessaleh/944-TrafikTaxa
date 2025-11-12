import { NextRequest, NextResponse } from 'next/server';
import { getUserFromCookie } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  console.log('🚀 API START - Invoice ID:', params.id);
  
  try {
    console.log('🔐 Checking authentication...');
    const me = await getUserFromCookie();
    if (!me) {
      console.log('❌ Not authenticated');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.log('✅ Authenticated as user:', me.id);

    const invoiceId = parseInt(params.id);
    console.log('🔢 Parsed invoice ID:', invoiceId, 'Type:', typeof invoiceId);
    
    if (isNaN(invoiceId) || invoiceId <= 0) {
      console.log('❌ Invalid invoice ID');
      return NextResponse.json({ error: 'Invalid invoice ID' }, { status: 400 });
    }

    console.log('📊 Fetching invoice from database...');
    console.log('💾 Database connection status:', prisma ? 'Connected' : 'Not connected');
    
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId }
    });

    console.log('📋 Invoice fetch result:', invoice ? `Found (ID: ${invoice.id})` : 'Not found');

    if (!invoice) {
      console.log('❌ Invoice not found');
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    console.log('🔒 Checking authorization...');
    console.log('👤 User ID:', me.id, 'Invoice user ID:', invoice.userId, 'User role:', me.role);
    
    if (invoice.userId !== me.id && me.role !== 'ADMIN') {
      console.log('❌ Access denied');
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    console.log('✅ Authorization passed');

    // Fetch complete user data
    console.log('👤 Fetching user data...');
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
      console.log('❌ User not found');
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    console.log('✅ User found:', user.firstName, user.lastName);

    // Fetch complete ride data
    console.log('🚗 Fetching ride data...');
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
      console.log('❌ Ride not found');
      return NextResponse.json({ error: 'Ride not found' }, { status: 404 });
    }

    console.log('✅ Ride found:', ride.pickupAddress, '→', ride.dropoffAddress);

    // Create complete response with all needed data
    const completeInvoice = {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      paymentStatus: invoice.paymentStatus,
      status: invoice.status,
      dueDate: invoice.dueDate.toISOString(),
      createdAt: invoice.createdAt.toISOString(),
      updatedAt: invoice.updatedAt.toISOString(),
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

    console.log('✅ Returning complete invoice data');
    return NextResponse.json({
      success: true,
      invoice: completeInvoice,
      user: me
    });

  } catch (error) {
    console.error('💥 API ERROR:', error);
    console.error('📚 Error type:', error instanceof Error ? error.constructor.name : 'Unknown');
    console.error('📝 Error message:', error instanceof Error ? error.message : 'No message');
    console.error('🏗️ Error stack:', error instanceof Error ? error.stack : 'No stack');
    
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ?
          (error instanceof Error ? error.message : 'Unknown error') : undefined,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}