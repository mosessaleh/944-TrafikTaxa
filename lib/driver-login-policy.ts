const TERMINAL_RIDE_STATUSES = ['CANCELED', 'COMPLETED', 'REFUNDED'] as const;

export const LOGIN_REASSIGN_MAX_HOURS = 11;
export const LOGIN_REASSIGN_GRACE_MINUTES = 15;
export const LOGIN_REASSIGN_THRESHOLD_MINUTES =
  LOGIN_REASSIGN_MAX_HOURS * 60 + LOGIN_REASSIGN_GRACE_MINUTES;
export const LOGIN_REASSIGN_THRESHOLD_MS = LOGIN_REASSIGN_THRESHOLD_MINUTES * 60 * 1000;

type DriverScheduledRidePreview = {
  id: number;
  pickupTime: string | null;
};

function normalizeDriverQueue(queue: unknown): number[] {
  if (!Array.isArray(queue)) return [];

  return queue
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0);
}

export async function getDriverScheduledRidesBeyondLoginWindow(
  prisma: any,
  driverId: number,
  now: Date = new Date()
): Promise<DriverScheduledRidePreview[]> {
  const thresholdDate = new Date(now.getTime() + LOGIN_REASSIGN_THRESHOLD_MS);

  const rides = await prisma.ride.findMany({
    where: {
      driverId,
      scheduled: true,
      pickupTime: { gt: thresholdDate },
      status: { notIn: TERMINAL_RIDE_STATUSES }
    },
    select: {
      id: true,
      pickupTime: true
    },
    orderBy: {
      pickupTime: 'asc'
    }
  });

  return rides.map((ride: { id: number; pickupTime: Date | null }) => ({
    id: ride.id,
    pickupTime: ride.pickupTime ? ride.pickupTime.toISOString() : null
  }));
}

export async function releaseDriverScheduledRidesBeyondLoginWindow(
  prisma: any,
  driverId: number,
  now: Date = new Date()
) {
  const thresholdDate = new Date(now.getTime() + LOGIN_REASSIGN_THRESHOLD_MS);

  const rides = await prisma.ride.findMany({
    where: {
      driverId,
      scheduled: true,
      pickupTime: { gt: thresholdDate },
      status: { notIn: TERMINAL_RIDE_STATUSES }
    },
    select: {
      id: true,
      pickupTime: true,
      driverQueue: true
    }
  });

  if (!rides.length) {
    return {
      count: 0,
      rideIds: [] as number[],
      rides: [] as DriverScheduledRidePreview[]
    };
  }

  const releasedRideIds: number[] = [];

  for (const ride of rides) {
    const nextQueue = normalizeDriverQueue((ride as any).driverQueue).filter(
      (queuedDriverId) => queuedDriverId !== Number(driverId)
    );

    try {
      await prisma.ride.update({
        where: { id: ride.id },
        data: {
          driverId: null,
          car: null,
          driverQueue: nextQueue
        }
      });

      releasedRideIds.push(ride.id);

      const scheduledOffers = (global as any).scheduledOffers;
      if (scheduledOffers?.has?.(ride.id)) {
        const offerState = scheduledOffers.get(ride.id);
        if (offerState?.timerId) {
          clearTimeout(offerState.timerId);
        }
        scheduledOffers.delete(ride.id);
      }

      const scheduledLateReassignments = (global as any).scheduledLateReassignments;
      if (scheduledLateReassignments?.has?.(ride.id)) {
        scheduledLateReassignments.delete(ride.id);
      }
    } catch (error) {
      console.error(
        `Failed releasing scheduled ride ${ride.id} for driver ${driverId} during login policy:`,
        error
      );
    }
  }

  if (releasedRideIds.length) {
    try {
      const checkForNewRides = (global as any).checkForNewRides;
      if (typeof checkForNewRides === 'function') {
        await checkForNewRides();
      }
    } catch (error) {
      console.error('Failed triggering immediate scheduled redistribution after login policy release:', error);
    }
  }

  return {
    count: releasedRideIds.length,
    rideIds: releasedRideIds,
    rides: rides
      .filter((ride: { id: number; pickupTime: Date | null }) => releasedRideIds.includes(ride.id))
      .map((ride: { id: number; pickupTime: Date | null }) => ({
        id: ride.id,
        pickupTime: ride.pickupTime ? ride.pickupTime.toISOString() : null
      }))
  };
}

