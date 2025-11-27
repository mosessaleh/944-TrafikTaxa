import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getUserFromCookie } from '@/lib/auth';
import { notifyUserInvoiceReady } from '@/lib/notify';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.log('=== payment-method API START ===');
    
    // 1. Authenticate user
    const me = await getUserFromCookie();
    if (!me) {
      console.log('❌ User not authenticated');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('✅ User authenticated:', { 
      userId: me.id, 
      email: (me as any).email,
      role: (me as any).role,
      canPayByInvoice: (me as any).canPayByInvoice
    });

    // 2. Parse booking ID
    const bookingId = parseInt(params.id);
    if (isNaN(bookingId) || bookingId <= 0) {
      console.log('❌ Invalid booking ID:', params.id);
      return NextResponse.json({ error: 'Invalid booking ID' }, { status: 400 });
    }

    console.log('✅ Booking ID parsed:', bookingId);

    // 3. Parse request body
    let requestBody;
    try {
      requestBody = await request.json();
    } catch (jsonError) {
      console.log('❌ Failed to parse JSON:', jsonError);
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const { paymentMethod } = requestBody;
    
    if (!paymentMethod) {
      console.log('❌ No payment method provided');
      return NextResponse.json({ error: 'Payment method required' }, { status: 400 });
    }

    console.log('✅ Payment method:', paymentMethod);

    // 4. Check booking exists
    const booking = await prisma.ride.findUnique({
      where: { id: bookingId },
      select: { id: true, userId: true, status: true, paymentStatus: true, paymentMethod: true }
    });

    if (!booking) {
      console.log('❌ Booking not found:', bookingId);
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    console.log('✅ Booking found:', { id: booking.id, userId: booking.userId });

    // 5. Check authorization
    if (booking.userId !== me.id && (me.type !== 'user' || (me as any).role !== 'ADMIN')) {
      console.log('❌ Access denied for booking:', { bookingId, userId: me.id });
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    console.log('✅ Authorization passed');

    // 6. Handle different payment methods
    let updatedBooking;
    
    if (paymentMethod === 'invoice') {
      console.log('💰 Processing INVOICE payment method');

      // Check invoice permissions
      if (!(me as any).canPayByInvoice && (me.type !== 'user' || (me as any).role !== 'ADMIN')) {
        console.log('❌ Invoice payment not allowed. User details:', {
          userId: me.id,
          canPayByInvoice: (me as any).canPayByInvoice,
          role: (me as any).role
        });
        return NextResponse.json({
          error: 'Invoice payment not available for your account'
        }, { status: 403 });
      }

      console.log('✅ Invoice payment permissions OK');

      // Get full booking details
      const fullBooking = await prisma.ride.findUnique({
        where: { id: bookingId },
        include: {
          user: true,
          vehicleType: true
        }
      });

      if (!fullBooking) {
        console.log('❌ Full booking not found');
        return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
      }

      console.log('✅ Full booking retrieved:', {
        id: fullBooking.id,
        price: fullBooking.price,
        userEmail: fullBooking.user.email
      });

      // Create invoice number in agreed format TUR-000023
      const invoiceNumber = `TUR-${fullBooking.id.toString().padStart(6, '0')}`;
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 8);

      console.log('📄 Creating invoice:', {
        invoiceNumber,
        userId: fullBooking.userId,
        rideId: fullBooking.id,
        dueDate: dueDate.toISOString()
      });

      let invoice;
      try {
        console.log('📋 Creating invoice with detailed data:', {
          invoiceNumber,
          userId: fullBooking.userId,
          rideId: fullBooking.id,
          dueDate: dueDate.toISOString(),
          paymentStatus: 'UNPAID',
          status: 1
        });
        
        console.log('🔍 Full booking data for debugging:', {
          id: fullBooking.id,
          userId: fullBooking.userId,
          price: fullBooking.price,
          status: fullBooking.status,
          paymentMethod: fullBooking.paymentMethod,
          createdAt: fullBooking.createdAt
        });
        
        console.log('📊 User data for debugging:', {
          userId: fullBooking.user.id,
          email: fullBooking.user.email,
          canPayByInvoice: fullBooking.user.canPayByInvoice
        });
        
        invoice = await prisma.invoice.create({
          data: {
            invoiceNumber,
            userId: fullBooking.userId,
            rideId: fullBooking.id,
            dueDate,
            paymentStatus: 'UNPAID',
            status: 1
          }
        });
        console.log('✅ Invoice created successfully:', invoice.id);
      } catch (createError) {
        console.error('❌ Invoice creation failed with full details:', {
          errorType: typeof createError,
          errorMessage: createError instanceof Error ? createError.message : 'Unknown error',
          errorStack: createError instanceof Error ? createError.stack : 'No stack',
          errorName: createError instanceof Error ? createError.name : 'Unknown name',
          errorCode: (createError as any).code || 'No code'
        });
        
        console.error('❌ Data that was being inserted:', {
          invoiceNumber,
          userId: fullBooking.userId,
          rideId: fullBooking.id,
          dueDate: dueDate.toISOString(),
          paymentStatus: 'UNPAID',
          status: 1
        });
        
        return NextResponse.json({
          error: 'Failed to create invoice',
          details: createError instanceof Error ? createError.message : 'Unknown error'
        }, { status: 500 });
      }

      // Update booking
      try {
        updatedBooking = await prisma.ride.update({
          where: { id: bookingId },
          data: {
            paymentMethod: 'invoice',
            status: 'CONFIRMED',
            paymentStatus: 'PENDING',
            explanation: 'Waiting to send a car'
          },
          include: {
            vehicleType: {
              select: {
                title: true,
                capacity: true
              }
            }
          }
        });
        console.log('✅ Booking updated successfully');
      } catch (updateError) {
        console.error('❌ Booking update failed:', updateError);
        return NextResponse.json({
          error: 'Failed to update booking',
          details: updateError instanceof Error ? updateError.message : 'Unknown error'
        }, { status: 500 });
      }

      // Send email (non-critical)
      try {
        await notifyUserInvoiceReady(fullBooking.user.email, fullBooking.user.firstName, {
          bookingId: fullBooking.id,
          price: fullBooking.price,
        }, invoice.id);
        console.log('✅ Invoice email sent');
      } catch (emailError) {
        console.log('⚠️ Email send failed (non-critical):', emailError instanceof Error ? emailError.message : 'Unknown error');
      }

    } else {
      // Other payment methods
      console.log('💳 Processing payment method:', paymentMethod);
      
      try {
        updatedBooking = await prisma.ride.update({
          where: { id: bookingId },
          data: { paymentMethod },
          include: {
            vehicleType: {
              select: {
                title: true,
                capacity: true
              }
            }
          }
        });
        console.log('✅ Payment method updated successfully');
      } catch (updateError) {
        console.error('❌ Payment method update failed:', updateError);
        return NextResponse.json({
          error: 'Failed to update payment method',
          details: updateError instanceof Error ? updateError.message : 'Unknown error'
        }, { status: 500 });
      }
    }

    // 7. Success response
    console.log('🎉 payment-method API completed successfully');
    return NextResponse.json({
      success: true,
      booking: {
        id: updatedBooking.id,
        status: updatedBooking.status,
        paymentStatus: updatedBooking.paymentStatus,
        paymentMethod: updatedBooking.paymentMethod
      }
    });

  } catch (error) {
    console.error('💥 payment-method API error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : 'Unknown error') : 'Internal server error'
      },
      { status: 500 }
    );
  }
}