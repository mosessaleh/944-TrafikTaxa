import { prisma } from './db';
import { stripe } from './stripe';

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
  refundId?: string;
  refundedAmountDkk?: number;
  canceledAuthorization?: boolean;
  additionalChargeAmountDkk?: number;
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
          { paymentStatus: 'UNPAID' },
          { paymentStatus: 'AUTHORIZED' }, // Authorized payments that need to be captured
          {
            paymentStatus: 'PENDING_PAYMENT',
            paymentRetryCount: { lt: 5 },
            paymentNextRetry: { lte: now }
          },
          {
            paymentStatus: 'UNPAID',
            paymentRetryCount: { lt: 5 },
            paymentNextRetry: { lte: now }
          }
        ],
        savedPaymentMethodId: { not: null }
      },
      include: {
        savedPaymentMethod: true,
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
 * Authorize and capture card payment (for booking confirmation)
 */
export async function authorizeCardPayment(booking: any, paymentMethod: any): Promise<PaymentResult> {
  console.log(`[DEBUG] authorizeCardPayment called for booking ${booking.id}, paymentMethod:`, paymentMethod);

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

    console.log(`[DEBUG] User stripeCustomerId:`, user?.stripeCustomerId);

    if (!user?.stripeCustomerId) {
      return {
        success: false,
        error: 'User does not have a Stripe customer account. Please add a payment method first.'
      };
    }

    // Ensure the payment method is attached to the customer
    try {
      await stripeClient.paymentMethods.attach(paymentMethod.token, { customer: user.stripeCustomerId });
    } catch (attachError: any) {
      // Ignore if already attached
      if (!attachError.message?.includes('already attached')) {
        console.log(`[DEBUG] Attach error (non-critical):`, attachError.message);
      }
    }

    // Create payment intent with manual capture (authorize only)
    const paymentIntent = await stripeClient.paymentIntents.create({
      amount: Math.round(booking.price * 100), // Convert to øre
      currency: 'dkk',
      customer: user.stripeCustomerId, // Required for payment methods from setup intents
      payment_method_types: ['card'],
      confirm: false, // Don't confirm yet
      capture_method: 'manual' // Authorize only, capture later
    });

    // Confirm the payment intent with the specific payment method
    const confirmedIntent = await stripeClient.paymentIntents.confirm(paymentIntent.id, {
      payment_method: paymentMethod.token
    });

    if (confirmedIntent.status === 'requires_capture') {
      // Payment authorized successfully - save Payment Intent ID for later capture
      await (prisma as any).ride.update({
        where: { id: booking.id },
        data: {
          paymentStatus: 'AUTHORIZED', // Payment is authorized but not captured yet
          paymentRef: confirmedIntent.id // Store Payment Intent ID
        }
      });

      return {
        success: true,
        transactionId: confirmedIntent.id
      };
    } else if (confirmedIntent.status === 'succeeded') {
      // Payment captured successfully (unexpected for manual capture, but handle it)
      await (prisma as any).ride.update({
        where: { id: booking.id },
        data: {
          paymentRef: confirmedIntent.id // Store Payment Intent ID
        }
      });

      return {
        success: true,
        transactionId: confirmedIntent.id
      };
    } else if (confirmedIntent.status === 'requires_action') {
      // Handle 3D Secure or other authentication requirements
      return {
        success: false,
        requiresAction: true,
        actionUrl: confirmedIntent.next_action?.redirect_to_url?.url || undefined,
        error: 'Customer authentication required'
      };
    } else {
      // Payment failed
      return {
        success: false,
        error: `Payment ${confirmedIntent.status}: ${confirmedIntent.last_payment_error?.message || 'Unknown error'}`
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
    paymentStatus: trip.paymentStatus,
    paymentRef: trip.paymentRef,
    price: trip.price,
    captureAmount: trip.captureAmount,
    hasUserPaymentMethod: !!trip.userpaymentmethod
  });

  const paymentMethod = trip.savedPaymentMethod;

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
 * Charge cancellation fee with proper authorization cancel/refund handling
 */
export async function chargeCancellationFee(
  trip: any,
  cancellationAmountDkk: number,
  originalAmountDkk: number
): Promise<PaymentResult> {
  const stripeClient = stripe();
  const paymentRef = trip.paymentRef;
  const safeCancellationAmountDkk = Math.max(0, Math.round(cancellationAmountDkk));
  const safeOriginalAmountDkk = Math.max(0, Math.round(originalAmountDkk));
  const deltaDkk = safeOriginalAmountDkk - safeCancellationAmountDkk;
  let authorizationCanceled = false;

  const paymentMethod = trip.savedPaymentMethod;

  console.log(`💳 chargeCancellationFee called for trip ${trip.id}`, {
    paymentStatus: trip.paymentStatus,
    paymentRef: trip.paymentRef,
    cancellationAmountDkk: safeCancellationAmountDkk,
    originalAmountDkk: safeOriginalAmountDkk,
    deltaDkk
  });

  // If payment is authorized but not captured, cancel the authorization first
  if (paymentRef && (trip.paymentStatus === 'AUTHORIZED' || trip.paymentStatus === 'PENDING_PAYMENT')) {
    try {
      await stripeClient.paymentIntents.cancel(paymentRef);
      console.log(`✅ Authorization canceled for trip ${trip.id}: ${paymentRef}`);
      authorizationCanceled = true;

      if (safeCancellationAmountDkk <= 0) {
        return {
          success: true,
          transactionId: paymentRef,
          canceledAuthorization: true
        };
      }
    } catch (error: any) {
      const message = error?.message || 'Unknown error';
      console.error(`❌ Failed to cancel authorization for trip ${trip.id}:`, message);
      return {
        success: false,
        error: `Failed to cancel authorization: ${message}`
      };
    }
  }

  // If payment was already captured, refund the difference (or charge extra if needed)
  if (paymentRef && trip.paymentStatus === 'PAID') {
    if (deltaDkk > 0) {
      try {
        const refund = await stripeClient.refunds.create({
          payment_intent: paymentRef,
          amount: Math.round(deltaDkk * 100)
        });

        console.log(`✅ Refunded ${deltaDkk} DKK for trip ${trip.id}: ${refund.id}`);
        return {
          success: true,
          transactionId: paymentRef,
          refundId: refund.id,
          refundedAmountDkk: deltaDkk
        };
      } catch (error: any) {
        const message = error?.message || 'Unknown error';
        console.error(`❌ Refund failed for trip ${trip.id}:`, message);
        return {
          success: false,
          error: `Refund failed: ${message}`
        };
      }
    }

    if (deltaDkk === 0) {
      return {
        success: true,
        transactionId: paymentRef
      };
    }
  }

  // If no charge is needed, return success
  if (safeCancellationAmountDkk <= 0) {
    return {
      success: true,
      transactionId: paymentRef
    };
  }

  // Determine charge amount
  const chargeAmountDkk = trip.paymentStatus === 'PAID'
    ? Math.max(0, Math.abs(deltaDkk))
    : safeCancellationAmountDkk;

  if (chargeAmountDkk <= 0) {
    return {
      success: true,
      transactionId: paymentRef,
      canceledAuthorization: authorizationCanceled || undefined
    };
  }

  if (!paymentMethod) {
    return {
      success: false,
      error: 'No saved payment method found'
    };
  }

  if (paymentMethod.provider !== 'stripe') {
    return {
      success: false,
      error: `Unsupported payment provider: ${paymentMethod.provider}`
    };
  }

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

  try {
    const paymentIntent = await stripeClient.paymentIntents.create({
      amount: Math.round(chargeAmountDkk * 100),
      currency: 'dkk',
      payment_method: paymentMethod.token,
      customer: user.stripeCustomerId,
      confirm: true,
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: 'never'
      }
    });

    if (paymentIntent.status === 'succeeded') {
      return {
        success: true,
        transactionId: paymentIntent.id,
        additionalChargeAmountDkk: trip.paymentStatus === 'PAID' && deltaDkk < 0 ? chargeAmountDkk : undefined,
        canceledAuthorization: authorizationCanceled || undefined
      };
    }

    if (paymentIntent.status === 'requires_action') {
      return {
        success: false,
        requiresAction: true,
        actionUrl: paymentIntent.next_action?.redirect_to_url?.url || undefined,
        error: 'Customer authentication required'
      };
    }

    return {
      success: false,
      error: `Payment ${paymentIntent.status}: ${paymentIntent.last_payment_error?.message || 'Unknown error'}`
    };
  } catch (error: any) {
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
 * Charge using Stripe saved payment method
 */
async function chargeStripePaymentMethod(trip: any, paymentMethod: any): Promise<PaymentResult> {
  const stripeClient = stripe();
  const amountDkk = typeof trip.captureAmount === 'number' ? trip.captureAmount : trip.price;
  const safeAmountDkk = Math.max(0, Math.round(amountDkk));
  const amountOre = Math.round(safeAmountDkk * 100);

  console.log(`🔄 Processing Stripe payment for trip ${trip.id}, paymentMethod:`, {
    id: paymentMethod.id,
    token: paymentMethod.token,
    provider: paymentMethod.provider,
    type: paymentMethod.type
  });

  try {
    // Check if payment was already captured
    if (trip.paymentStatus === 'PAID' && trip.paymentRef) {
      console.log(`✅ Payment already captured for trip ${trip.id}, transaction: ${trip.paymentRef}`);
      return {
        success: true,
        transactionId: trip.paymentRef
      };
    }

    // Check if we have a stored Payment Intent ID for capture
    if (trip.paymentRef && amountOre > 0) {
      console.log(`🔄 Attempting to capture existing Payment Intent: ${trip.paymentRef}`);

      try {
        // Capture the existing authorized payment
        const capturedPaymentIntent = await stripeClient.paymentIntents.capture(trip.paymentRef, {
          amount_to_capture: amountOre
        });

        if (capturedPaymentIntent.status === 'succeeded') {
          // Update trip payment status
          await updateTripPaymentSuccess(trip.id, {
            transactionId: capturedPaymentIntent.id,
            provider: 'stripe',
            amount: safeAmountDkk
          });

          return {
            success: true,
            transactionId: capturedPaymentIntent.id
          };
        } else {
          console.log(`⚠️ Capture failed with status: ${capturedPaymentIntent.status}, falling back to new payment intent`);
        }
      } catch (captureError: any) {
        console.log(`⚠️ Capture exception: ${captureError.message}, falling back to new payment intent`);
      }
    }

    // Fallback: Create new payment intent
    console.log(`💳 Creating new payment intent for trip ${trip.id}`);

    if (amountOre <= 0) {
      return {
        success: false,
        error: 'Invalid capture amount'
      };
    }

    // Get the user's Stripe customer ID from database
    const user = await prisma.user.findUnique({
      where: { id: trip.userId },
      select: { stripeCustomerId: true }
    });

    console.log(`User stripeCustomerId for trip ${trip.id}:`, user?.stripeCustomerId);

    if (!user?.stripeCustomerId) {
      console.log(`❌ No Stripe customer ID found for user ${trip.userId} in trip ${trip.id}`);
      return {
        success: false,
        error: 'User does not have a Stripe customer account'
      };
    }

    // Create payment intent with saved payment method
    const paymentIntent = await stripeClient.paymentIntents.create({
      amount: amountOre, // Convert to øre
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
        amount: safeAmountDkk
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

  // Record the payment in CardPayment table for card transactions
  if (paymentData.provider === 'stripe') {
    try {
      await prisma.cardPayment.create({
        data: {
          userId: null, // Will be set if we have user context
          amountDkk: paymentData.amount / 100, // Convert from øre to DKK
          status: 'paid'
        }
      });
      console.log(`✅ Recorded card payment for ride ${tripId} in CardPayment table`);
    } catch (cardPaymentError: any) {
      console.error(`❌ Failed to record card payment for ride ${tripId}:`, cardPaymentError);
    }
  }

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
        OR: [
          {
            paymentStatus: 'PENDING_PAYMENT',
            paymentRetryCount: { lt: 5 }, // Max 5 retries
            paymentNextRetry: { lte: now },
            savedPaymentMethodId: { not: null }
          },
          {
            paymentStatus: 'UNPAID',
            paymentRetryCount: { lt: 5 }, // Max 5 retries
            paymentNextRetry: { lte: now },
            savedPaymentMethodId: { not: null }
          }
        ]
      },
      include: {
        savedPaymentMethod: true,
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
