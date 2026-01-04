const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

class DriverStatusMonitor {
  constructor(io) {
    this.io = io;
    this.isRunning = false;
    this.intervalId = null;
    this.lastCheckedId = 0;
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log('Driver status monitor started');

    // Check for changes every 5 seconds
    this.intervalId = setInterval(() => this.checkForChanges(), 5000);
  }

  stop() {
    if (!this.isRunning) return;
    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    console.log('Driver status monitor stopped');
  }

  async checkForChanges() {
    try {
      // Get all drivers (assuming not too many) and check for changes
      // In production, you might want to optimize this
      const allDrivers = await prisma.comDriver.findMany({
        select: {
          id: true,
          isOnline: true,
          isBusy: true,
          currentRideId: true,
          rideAccepted: true
        }
      });

      // For simplicity, send update for all drivers
      // In a real implementation, you'd track previous states
      for (const driver of allDrivers) {
        if (this.io) {
          this.io.to(`driver_${driver.id}`).emit('driverStatusUpdate', {
            isOnline: driver.isOnline,
            currentRideId: driver.currentRideId,
            isBusy: driver.isBusy,
            rideAccepted: driver.rideAccepted,
            timestamp: Date.now()
          });
        }
      }

      if (allDrivers.length > 0) {
        console.log(`Sent status updates for ${allDrivers.length} drivers`);
      }
    } catch (error) {
      console.error('Error checking driver status changes:', error);
    }
  }
}

module.exports = DriverStatusMonitor;