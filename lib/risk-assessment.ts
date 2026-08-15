import { prisma } from '@/lib/db';

export interface RiskFactor {
  type: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  score: number;
}

export interface RiskAssessment {
  score: number;
  level: 'low' | 'medium' | 'high' | 'critical';
  factors: RiskFactor[];
}

/**
 * Comprehensive risk assessment for bookings
 */
export async function assessBookingRisk(bookingData: {
  userId: number;
  pickupAddress: string;
  dropoffAddress: string;
  pickupTime: Date;
  price: number;
  passengers: number;
  paymentMethod?: string;
  distanceKm?: number;
}): Promise<RiskAssessment> {
  const factors: RiskFactor[] = [];
  let totalScore = 0;

  // 1. User History Analysis
  const userRisk = await assessUserRisk(bookingData.userId);
  factors.push(...userRisk.factors);
  totalScore += userRisk.score;

  // 2. Booking Pattern Analysis
  const patternRisk = await assessBookingPattern(bookingData);
  factors.push(...patternRisk.factors);
  totalScore += patternRisk.score;

  // 3. Geographic Risk Analysis
  const geoRisk = assessGeographicRisk(bookingData.pickupAddress, bookingData.dropoffAddress);
  factors.push(...geoRisk.factors);
  totalScore += geoRisk.score;

  // 4. Temporal Risk Analysis
  const temporalRisk = assessTemporalRisk(bookingData.pickupTime);
  factors.push(...temporalRisk.factors);
  totalScore += temporalRisk.score;

  // 5. Financial Risk Analysis
  const financialRisk = assessFinancialRisk(bookingData.price, bookingData.paymentMethod);
  factors.push(...financialRisk.factors);
  totalScore += financialRisk.score;

  // 6. Distance/Route Risk Analysis
  if (bookingData.distanceKm) {
    const distanceRisk = assessDistanceRisk(bookingData.distanceKm, bookingData.price);
    factors.push(...distanceRisk.factors);
    totalScore += distanceRisk.score;
  }

  // 7. Passenger Count Risk
  const passengerRisk = assessPassengerRisk(bookingData.passengers);
  factors.push(...passengerRisk.factors);
  totalScore += passengerRisk.score;

  // Cap score at 100 and determine level
  totalScore = Math.min(totalScore, 100);

  let level: 'low' | 'medium' | 'high' | 'critical';
  if (totalScore >= 80) level = 'critical';
  else if (totalScore >= 60) level = 'high';
  else if (totalScore >= 40) level = 'medium';
  else level = 'low';

  return {
    score: Math.round(totalScore),
    level,
    factors
  };
}

/**
 * Assess user-based risk factors
 */
async function assessUserRisk(userId: number): Promise<{ score: number; factors: RiskFactor[] }> {
  const factors: RiskFactor[] = [];
  let score = 0;

  try {
    // Get user booking history
    const userBookings = await (prisma as any).ride.findMany({
      where: { userId },
      select: {
        status: true,
        paymentStatus: true,
        createdAt: true,
        price: true
      },
      orderBy: { createdAt: 'desc' },
      take: 20 // Last 20 bookings
    });

    const totalBookings = userBookings.length;
    const completedBookings = userBookings.filter((b: any) => b.status === 'COMPLETED').length;
    const cancelledBookings = userBookings.filter((b: any) => b.status === 'CANCELED').length;
    const unpaidBookings = userBookings.filter((b: any) => b.paymentStatus === 'UNPAID').length;

    // New user risk
    if (totalBookings < 3) {
      factors.push({
        type: 'new_user',
        description: 'New user with limited booking history',
        severity: 'medium',
        score: 15
      });
      score += 15;
    }

    // High cancellation rate
    const cancellationRate = totalBookings > 0 ? (cancelledBookings / totalBookings) * 100 : 0;
    if (cancellationRate > 50) {
      factors.push({
        type: 'high_cancellation_rate',
        description: `High cancellation rate: ${cancellationRate.toFixed(1)}%`,
        severity: 'high',
        score: 25
      });
      score += 25;
    } else if (cancellationRate > 30) {
      factors.push({
        type: 'moderate_cancellation_rate',
        description: `Moderate cancellation rate: ${cancellationRate.toFixed(1)}%`,
        severity: 'medium',
        score: 15
      });
      score += 15;
    }

    // Unpaid bookings
    if (unpaidBookings > 2) {
      factors.push({
        type: 'unpaid_history',
        description: `Multiple unpaid bookings: ${unpaidBookings}`,
        severity: 'high',
        score: 20
      });
      score += 20;
    }

    // Recent booking frequency (potential spam)
    const recentBookings = userBookings.filter((b: any) =>
      new Date(b.createdAt) > new Date(Date.now() - 24 * 60 * 60 * 1000)
    ).length;

    if (recentBookings > 5) {
      factors.push({
        type: 'frequent_bookings',
        description: `Multiple bookings in 24h: ${recentBookings}`,
        severity: 'medium',
        score: 15
      });
      score += 15;
    }

  } catch (error) {
    console.error('Error assessing user risk:', error);
  }

  return { score, factors };
}

/**
 * Assess booking pattern risks
 */
async function assessBookingPattern(bookingData: any): Promise<{ score: number; factors: RiskFactor[] }> {
  const factors: RiskFactor[] = [];
  let score = 0;

  try {
    // Check for similar bookings in short time
    const similarBookings = await (prisma as any).ride.findMany({
      where: {
        userId: bookingData.userId,
        pickupAddress: bookingData.pickupAddress,
        dropoffAddress: bookingData.dropoffAddress,
        createdAt: {
          gte: new Date(Date.now() - 60 * 60 * 1000) // Last hour
        }
      }
    });

    if (similarBookings.length > 0) {
      factors.push({
        type: 'duplicate_booking',
        description: 'Similar booking created recently',
        severity: 'medium',
        score: 20
      });
      score += 20;
    }

    // Check for round trips or unusual patterns
    const userRecentBookings = await (prisma as any).ride.findMany({
      where: {
        userId: bookingData.userId,
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last week
        }
      },
      select: {
        pickupAddress: true,
        dropoffAddress: true,
        createdAt: true
      }
    });

    // Detect potential round trip abuse
    const roundTrips = userRecentBookings.filter((booking: any) =>
      booking.pickupAddress === bookingData.dropoffAddress &&
      booking.dropoffAddress === bookingData.pickupAddress
    ).length;

    if (roundTrips > 2) {
      factors.push({
        type: 'frequent_round_trips',
        description: 'Frequent round trip bookings detected',
        severity: 'medium',
        score: 15
      });
      score += 15;
    }

  } catch (error) {
    console.error('Error assessing booking pattern:', error);
  }

  return { score, factors };
}

/**
 * Assess geographic risk factors
 */
function assessGeographicRisk(pickupAddress: string, dropoffAddress: string): { score: number; factors: RiskFactor[] } {
  const factors: RiskFactor[] = [];
  let score = 0;

  // Check for suspicious locations (airports, borders, etc.)
  const highRiskKeywords = ['airport', 'border', 'port', 'train station', 'bus station'];
  const pickupRisky = highRiskKeywords.some(keyword =>
    pickupAddress.toLowerCase().includes(keyword)
  );
  const dropoffRisky = highRiskKeywords.some(keyword =>
    dropoffAddress.toLowerCase().includes(keyword)
  );

  if (pickupRisky || dropoffRisky) {
    factors.push({
      type: 'high_risk_location',
      description: 'Booking involves high-risk location',
      severity: 'medium',
      score: 15
    });
    score += 15;
  }

  // Same pickup/dropoff (potential test booking)
  if (pickupAddress === dropoffAddress) {
    factors.push({
      type: 'same_address',
      description: 'Pickup and dropoff addresses are identical',
      severity: 'high',
      score: 25
    });
    score += 25;
  }

  return { score, factors };
}

/**
 * Assess temporal risk factors
 */
function assessTemporalRisk(pickupTime: Date): { score: number; factors: RiskFactor[] } {
  const factors: RiskFactor[] = [];
  let score = 0;

  const now = new Date();
  const timeDiff = pickupTime.getTime() - now.getTime();
  const hoursDiff = timeDiff / (1000 * 60 * 60);

  // Too far in the future
  if (hoursDiff > 168) { // More than a week
    factors.push({
      type: 'distant_booking',
      description: 'Booking too far in the future',
      severity: 'medium',
      score: 10
    });
    score += 10;
  }

  // Last minute booking
  if (hoursDiff < 1 && hoursDiff > 0) {
    factors.push({
      type: 'last_minute',
      description: 'Last minute booking',
      severity: 'low',
      score: 5
    });
    score += 5;
  }

  // Unusual hours (late night)
  const hour = pickupTime.getHours();
  if (hour >= 2 && hour <= 5) {
    factors.push({
      type: 'late_night',
      description: 'Late night booking (2-5 AM)',
      severity: 'medium',
      score: 10
    });
    score += 10;
  }

  return { score, factors };
}

/**
 * Assess financial risk factors
 */
function assessFinancialRisk(price: number, paymentMethod?: string): { score: number; factors: RiskFactor[] } {
  const factors: RiskFactor[] = [];
  let score = 0;

  // Very high price
  if (price > 5000) { // More than 5000 DKK
    factors.push({
      type: 'high_value_booking',
      description: `High value booking: ${price} DKK`,
      severity: 'medium',
      score: 15
    });
    score += 15;
  }

  // Very low price (potential test)
  if (price < 50) { // Less than 50 DKK
    factors.push({
      type: 'low_value_booking',
      description: `Unusually low price: ${price} DKK`,
      severity: 'medium',
      score: 10
    });
    score += 10;
  }

  // Cash payment (higher risk)
  if (paymentMethod === 'cash' || !paymentMethod) {
    factors.push({
      type: 'cash_payment',
      description: 'Cash payment method',
      severity: 'low',
      score: 5
    });
    score += 5;
  }

  return { score, factors };
}

/**
 * Assess distance/route risk factors
 */
function assessDistanceRisk(distanceKm: number, price: number): { score: number; factors: RiskFactor[] } {
  const factors: RiskFactor[] = [];
  let score = 0;

  // Very long distance
  if (distanceKm > 500) { // More than 500km
    factors.push({
      type: 'long_distance',
      description: `Very long distance: ${distanceKm}km`,
      severity: 'medium',
      score: 10
    });
    score += 10;
  }

  // Price per km analysis
  if (distanceKm <= 0) return { score: 0, factors };
  const pricePerKm = price / distanceKm;
  if (pricePerKm > 50) { // More than 50 DKK per km
    factors.push({
      type: 'high_price_per_km',
      description: `High price per km: ${pricePerKm.toFixed(1)} DKK/km`,
      severity: 'medium',
      score: 15
    });
    score += 15;
  }

  return { score, factors };
}

/**
 * Assess passenger count risk factors
 */
function assessPassengerRisk(passengers: number): { score: number; factors: RiskFactor[] } {
  const factors: RiskFactor[] = [];
  let score = 0;

  // Unusual passenger count
  if (passengers > 8) {
    factors.push({
      type: 'high_passenger_count',
      description: `High passenger count: ${passengers}`,
      severity: 'medium',
      score: 10
    });
    score += 10;
  }

  if (passengers === 0) {
    factors.push({
      type: 'zero_passengers',
      description: 'Booking with zero passengers',
      severity: 'high',
      score: 20
    });
    score += 20;
  }

  return { score, factors };
}

/**
 * Update booking with risk assessment
 */
export async function updateBookingRisk(bookingId: number, assessment: RiskAssessment): Promise<void> {
  try {
    await (prisma as any).ride.update({
      where: { id: bookingId },
      data: {
        riskScore: assessment.score,
        riskLevel: assessment.level,
        riskFactors: JSON.stringify(assessment.factors),
        riskReviewed: assessment.level === 'low' // Auto-approve low risk
      }
    });
  } catch (error) {
    console.error('Error updating booking risk:', error);
    throw error;
  }
}

/**
 * Get high-risk bookings requiring review
 */
export async function getHighRiskBookings(limit: number = 50): Promise<any[]> {
  try {
    return await (prisma as any).ride.findMany({
      where: {
        OR: [
          { riskLevel: 'high' },
          { riskLevel: 'critical' },
          {
            riskLevel: 'medium',
            riskReviewed: false
          }
        ]
      },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true
          }
        }
      },
      orderBy: [
        { riskScore: 'desc' },
        { createdAt: 'desc' }
      ],
      take: limit
    });
  } catch (error) {
    console.error('Error fetching high-risk bookings:', error);
    return [];
  }
}