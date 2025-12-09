import { prisma } from '@/lib/db';
import { stripe } from '@/lib/stripe';

/**
 * Payment Processor Service
 * Handles post-trip payment processing for completed rides
 */

export interface PaymentResult {
  success: boolean;
  transactionId?: string;
  error?: string;
  requiresAction?: boolean;
  actionUrl?: string;
}

/**
 * Process payments for completed but unpaid rides
 */
export async function processCompletedTripPayments(): Promise<{
  processed: number;
  successful: number;
  failed: number;
  errors: string[];
}> {
  const results = {
    processed: 0,
    successful: 0,
    failed: 0,
    errors: [] as string[]
  };

  const now = new Date();

  try {
    // Find completed rides that haven't been paid yet or need retry
    const completedUnpaidTrips = await (prisma as any).ride.findMany({
      where: {
        status: 'COMPLETED',
        OR: [
          { paymentStatus: 'PENDING_PAYMENT' },
          {
            paymentStatus: 'PENDING_PAYMENT',
            paymentRetryCount: { lt: 5 },
            paymentNextRetry: { lte: now }
          }
        ],
        savedPaymentMethodId: { not: null }
      },
      include: {
        userpaymentmethod: true,
        user: true
      }
    });

    console.log(`Found ${completedUnpaidTrips.length} completed trips pending payment`);

    for (const trip of completedUnpaidTrips) {
      results.processed++;

      try {
        const paymentResult = await chargeSavedPaymentMethod(trip);

        if (paymentResult.success) {
          results.successful++;
          console.log(`✅ Payment successful for trip ${trip.id}, transaction: ${paymentResult.transactionId}`);
        } else {
          results.failed++;
          const errorMsg = `❌ Payment failed for trip ${trip.id}: ${paymentResult.error}`;
          results.errors.push(errorMsg);
          console.error(errorMsg);

          // Handle specific error types
          await handlePaymentFailure(trip, paymentResult);
        }
      } catch (error: any) {
        results.failed++;
        const errorMsg = `💥 Exception processing trip ${trip.id}: ${error.message}`;
        results.errors.push(errorMsg);
        console.error(errorMsg);
      }
    }

  } catch (error: any) {
    console.error('Error in payment processor:', error);
    results.errors.push(`Payment processor error: ${error.message}`);
  }

  return results;
}

/**
 * Authorize card payment without capture (for booking confirmation)
 */
export async function authorizeCardPayment(booking: any, paymentMethod: any): Promise<PaymentResult> {
  if (!paymentMethod || paymentMethod.provider !== 'stripe') {
    return {
      success: false,
      error: 'Only Stripe card payments are supported for authorization'
    };
  }

  const stripeClient = stripe();

  try {
    // Get the user's Stripe customer ID from database
    const user = await prisma.user.findUnique({
      where: { id: booking.userId },
      select: { stripeCustomerId: true }
    });

    if (!user?.stripeCustomerId) {
      return {
        success: false,
        error: 'User does not have a Stripe customer account. Please add a payment method first.'
      };
    }

    // Create payment intent with manual capture (authorization only)
    const paymentIntent = await stripeClient.paymentIntents.create({
      amount: Math.round(booking.price * 100), // Convert to øre
      currency: 'dkk',
      payment_method: paymentMethod.token, // Stripe payment method ID
      customer: user.stripeCustomerId, // Required for payment methods from setup intents
      confirm: true, // Confirm immediately
      capture_method: 'manual', // Authorize only, don't capture
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: 'never' // Prevent redirect-based payment methods
      }
    });

    if (paymentIntent.status === 'requires_capture') {
      // Payment authorized successfully - save Payment Intent ID for later capture
      await (prisma as any).ride.update({
        where: { id: booking.id },
        data: {
          paymentRef: paymentIntent.id // Store Payment Intent ID for capture
        }
      });

      return {
        success: true,
        transactionId: paymentIntent.id
      };
    } else if (paymentIntent.status === 'requires_action') {
      // Handle 3D Secure or other authentication requirements
      return {
        success: false,
        requiresAction: true,
        actionUrl: paymentIntent.next_action?.redirect_to_url?.url || undefined,
        error: 'Customer authentication required'
      };
    } else {
      // Authorization failed
      return {
        success: false,
        error: `Authorization ${paymentIntent.status}: ${paymentIntent.last_payment_error?.message || 'Unknown error'}`
      };
    }

  } catch (error: any) {
    // Handle Stripe-specific errors
    if (error.type === 'card_error') {
      return {
        success: false,
        error: `Card error: ${error.message}`
      };
    }

    return {
      success: false,
      error: `Stripe error: ${error.message}`
    };
  }
}

/**
 * Charge a saved payment method for a completed trip
 */
export async function chargeSavedPaymentMethod(trip: any): Promise<PaymentResult> {
  console.log(`💳 chargeSavedPaymentMethod called for trip ${trip.id}`);
  console.log(`Trip data:`, {
    savedPaymentMethodId: trip.savedPaymentMethodId,
    paymentMethod: trip.paymentMethod,
    hasUserPaymentMethod: !!trip.userpaymentmethod
  });

  const paymentMethod = trip.userpaymentmethod;

  if (!paymentMethod) {
    console.log(`❌ No saved payment method found for trip ${trip.id}`);
    return {
      success: false,
      error: 'No saved payment method found'
    };
  }

  console.log(`✅ Found payment method: ${paymentMethod.provider} for trip ${trip.id}`);

  try {
    switch (paymentMethod.provider) {
      case 'stripe':
        return await chargeStripePaymentMethod(trip, paymentMethod);

      case 'paypal':
        return await chargePayPalPaymentMethod(trip, paymentMethod);

      case 'revolut':
        return await chargeRevolutPaymentMethod(trip, paymentMethod);

      default:
        return {
          success: false,
          error: `Unsupported payment provider: ${paymentMethod.provider}`
        };
    }
  } catch (error: any) {
    return {
      success: false,
      error: `Payment processing error: ${error.message}`
    };
  }
}

/**
 * Charge using Stripe saved payment method
 */
async function chargeStripePaymentMethod(trip: any, paymentMethod: any): Promise<PaymentResult> {
  const stripeClient = stripe();

  try {
    // Check if we have a stored Payment Intent ID for capture
    if (trip.paymentRef) {
      console.log(`🔄 Capturing existing Payment Intent: ${trip.paymentRef}`);

      // Capture the existing authorized payment
      const capturedPaymentIntent = await stripeClient.paymentIntents.capture(trip.paymentRef);

      if (capturedPaymentIntent.status === 'succeeded') {
        // Update trip payment status
        await updateTripPaymentSuccess(trip.id, {
          transactionId: capturedPaymentIntent.id,
          provider: 'stripe',
          amount: trip.price
        });

        return {
          success: true,
          transactionId: capturedPaymentIntent.id
        };
      } else {
        return {
          success: false,
          error: `Capture failed: ${capturedPaymentIntent.status}`
        };
      }
    } else {
      // Fallback: Create new payment intent (for backward compatibility)
      console.log(`⚠️ No stored Payment Intent found, creating new one for trip ${trip.id}`);

      // Get the user's Stripe customer ID from database
      const user = await prisma.user.findUnique({
        where: { id: trip.userId },
        select: { stripeCustomerId: true }
      });

      if (!user?.stripeCustomerId) {
        return {
          success: false,
          error: 'User does not have a Stripe customer account'
        };
      }

      // Create payment intent with saved payment method
      const paymentIntent = await stripeClient.paymentIntents.create({
        amount: Math.round(trip.price * 100), // Convert to øre
        currency: 'dkk',
        payment_method: paymentMethod.token, // Stripe payment method ID
        customer: user.stripeCustomerId, // Required for payment methods from setup intents
        confirm: true, // Confirm immediately
        automatic_payment_methods: {
          enabled: true,
          allow_redirects: 'never' // Prevent redirect-based payment methods
        }
      });

      if (paymentIntent.status === 'succeeded') {
        // Update trip payment status
        await updateTripPaymentSuccess(trip.id, {
          transactionId: paymentIntent.id,
          provider: 'stripe',
          amount: trip.price
        });

        return {
          success: true,
          transactionId: paymentIntent.id
        };
      } else if (paymentIntent.status === 'requires_action') {
        // Handle 3D Secure or other authentication requirements
        await updateTripPaymentRequiresAction(trip.id, paymentIntent);

        return {
          success: false,
          requiresAction: true,
          actionUrl: paymentIntent.next_action?.redirect_to_url?.url || undefined,
          error: 'Customer authentication required'
        };
      } else {
        // Payment failed
        return {
          success: false,
          error: `Payment ${paymentIntent.status}: ${paymentIntent.last_payment_error?.message || 'Unknown error'}`
        };
      }
    }

  } catch (error: any) {
    // Handle Stripe-specific errors
    if (error.type === 'card_error') {
      return {
        success: false,
        error: `Card error: ${error.message}`
      };
    }

    return {
      success: false,
      error: `Stripe error: ${error.message}`
    };
  }
}

/**
 * Charge using PayPal (placeholder - needs PayPal SDK integration)
 */
async function chargePayPalPaymentMethod(trip: any, paymentMethod: any): Promise<PaymentResult> {
  // TODO: Implement PayPal payment processing
  // This would require PayPal SDK and proper integration

  return {
    success: false,
    error: 'PayPal payment processing not yet implemented'
  };
}

/**
 * Charge using Revolut (placeholder - needs Revolut API integration)
 */
async function chargeRevolutPaymentMethod(trip: any, paymentMethod: any): Promise<PaymentResult> {
  // TODO: Implement Revolut payment processing
  // This would require Revolut API integration

  return {
    success: false,
    error: 'Revolut payment processing not yet implemented'
  };
}

/**
 * Update trip when payment succeeds
 */
async function updateTripPaymentSuccess(
  tripId: number,
  paymentData: { transactionId: string; provider: string; amount: number }
) {
  // Get current ride to check existing paymentMethod
  const currentRide = await (prisma as any).ride.findUnique({
    where: { id: tripId },
    select: { paymentMethod: true, paymentStatus: true }
  });

  const updateData: any = {
    paymentStatus: 'PAID',
    explanation: `Payment collected after trip completion - Transaction: ${paymentData.transactionId}`,
    // TODO: Add payment date and other metadata
  };

  // Only update paymentMethod if it's not already set (to preserve 'card', 'invoice', etc.)
  if (!currentRide?.paymentMethod) {
    updateData.paymentMethod = paymentData.provider;
  }

  await (prisma as any).ride.update({
    where: { id: tripId },
    data: updateData
  });

  console.log(`✅ Updated ride ${tripId} payment status to PAID, method: ${updateData.paymentMethod || currentRide?.paymentMethod}`);

  // TODO: Create receipt/invoice record
  // TODO: Send payment confirmation notification
}

/**
 * Update trip when payment requires action
 */
async function updateTripPaymentRequiresAction(tripId: number, paymentIntent: any) {
  await (prisma as any).ride.update({
    where: { id: tripId },
    data: {
      paymentStatus: 'REQUIRES_AUTH',
      explanation: `Payment requires customer authentication - ${paymentIntent.id}`,
      // TODO: Store authentication URL and expiry
    }
  });

  // TODO: Send notification to customer requesting authentication
}

/**
 * Handle payment failure scenarios
 */
async function handlePaymentFailure(trip: any, paymentResult: PaymentResult) {
  const now = new Date();
  const retryCount = (trip.paymentRetryCount || 0) + 1;
  const nextRetry = calculateNextRetryTime(retryCount);

  // Update trip with failure information and retry scheduling
  await (prisma as any).ride.update({
    where: { id: trip.id },
    data: {
      explanation: `Payment failed (attempt ${retryCount}): ${paymentResult.error}`,
      paymentRetryCount: retryCount,
      paymentNextRetry: retryCount < 5 ? nextRetry : null, // Stop retrying after 5 attempts
      paymentLastAttempt: now,
      paymentFailureReason: paymentResult.error
    }
  });

  // If max retries reached, mark as permanently failed
  if (retryCount >= 5) {
    await (prisma as any).ride.update({
      where: { id: trip.id },
      data: {
        paymentStatus: 'PAYMENT_FAILED',
        explanation: `Payment permanently failed after ${retryCount} attempts: ${paymentResult.error}`
      }
    });

    // TODO: Send final failure notification
    // TODO: Create invoice for manual collection
    console.log(`💀 Payment permanently failed for trip ${trip.id} after ${retryCount} attempts`);
  }

  // TODO: Send retry notification to customer/admin
}

/**
 * Retry failed payments with exponential backoff
 */
export async function retryFailedPayments(): Promise<{
  retried: number;
  successful: number;
  stillFailed: number;
}> {
  const results = {
    retried: 0,
    successful: 0,
    stillFailed: 0
  };

  try {
    const now = new Date();

    // Find trips eligible for retry
    const eligibleForRetry = await (prisma as any).ride.findMany({
      where: {
        paymentStatus: 'PENDING_PAYMENT',
        paymentRetryCount: { lt: 5 }, // Max 5 retries
        paymentNextRetry: { lte: now },
        savedPaymentMethodId: { not: null }
      },
      include: {
        userpaymentmethod: true,
        user: true
      }
    });

    console.log(`Found ${eligibleForRetry.length} trips eligible for payment retry`);

    for (const trip of eligibleForRetry) {
      results.retried++;

      try {
        const paymentResult = await chargeSavedPaymentMethod(trip);

        if (paymentResult.success) {
          results.successful++;
          console.log(`✅ Retry successful for trip ${trip.id}`);

          // Clear retry fields on success
          await (prisma as any).ride.update({
            where: { id: trip.id },
            data: {
              paymentRetryCount: 0,
              paymentNextRetry: null,
              paymentLastAttempt: null,
              paymentFailureReason: null
            }
          });

        } else {
          results.stillFailed++;
          console.log(`❌ Retry failed for trip ${trip.id}: ${paymentResult.error}`);

          // Update retry information
          const retryCount = (trip.paymentRetryCount || 0) + 1;
          const nextRetry = calculateNextRetryTime(retryCount);

          await (prisma as any).ride.update({
            where: { id: trip.id },
            data: {
              paymentRetryCount: retryCount,
              paymentNextRetry: nextRetry,
              paymentLastAttempt: now,
              paymentFailureReason: paymentResult.error
            }
          });
        }
      } catch (error: any) {
        results.stillFailed++;
        console.error(`💥 Exception during retry for trip ${trip.id}:`, error);
      }
    }

  } catch (error: any) {
    console.error('Error in retry payment processor:', error);
  }

  return results;
}

/**
 * Calculate next retry time using exponential backoff
 * Retry schedule: 1 hour, 4 hours, 12 hours, 24 hours, 48 hours
 */
function calculateNextRetryTime(retryCount: number): Date {
  const baseDelayHours = [1, 4, 12, 24, 48]; // Hours
  const delayHours = baseDelayHours[Math.min(retryCount - 1, baseDelayHours.length - 1)] || 48;

  const nextRetry = new Date();
  nextRetry.setHours(nextRetry.getHours() + delayHours);

  return nextRetry;
}