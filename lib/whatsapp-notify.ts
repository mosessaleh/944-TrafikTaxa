import { prisma } from '@/lib/db';
import { sendWAText, sendWATemplate } from '@/lib/wa-client';
import { logWAError } from '@/lib/wa-logger';

async function sendTemplateOrText(
  phone: string,
  templateName: string,
  params: string[],
  fallbackText: string,
): Promise<void> {
  const sent = await sendWATemplate(phone, templateName, 'en', params);
  if (!sent) {
    await sendWAText(phone, fallbackText);
  }
}

/**
 * Notify customer that a driver accepted their ride
 */
export async function notifyDriverAccepted(rideId: number) {
  try {
    const ride = await prisma.ride.findUnique({
      where: { id: rideId },
      select: {
        id: true,
        pickupAddress: true,
        dropoffAddress: true,
        user: { select: { phone: true, firstName: true } },
        driver: {
          select: {
            drFname: true,
            drLname: true,
            car: true,
            drPhone: true,
          },
        },
      },
    });

    if (!ride?.user?.phone) return;

    const driver = ride.driver as any;
    const driverName = driver ? `${driver.drFname} ${driver.drLname}` : 'Driver';
    const carInfo = driver?.car || 'N/A';

    const msg = `🚕 *Driver assigned!*\n\n`
      + `Driver: ${driverName}\n`
      + `Car: ${carInfo}\n`
      + `📋 Ride #${ride.id}\n`
      + `📍 ${ride.pickupAddress} → ${ride.dropoffAddress}\n\n`
      + `The driver is on the way to pick you up.`;

    await sendTemplateOrText(ride.user.phone, 'driver_assigned', [
      driverName,
      carInfo,
      String(ride.id),
      ride.pickupAddress,
      ride.dropoffAddress,
    ], msg);
  } catch (e) {
    logWAError('[WA Notify] Driver accepted error:', e);
  }
}

/**
 * Notify customer that they've been picked up
 */
export async function notifyCustomerPickedUp(rideId: number) {
  try {
    const ride = await prisma.ride.findUnique({
      where: { id: rideId },
      select: {
        id: true,
        dropoffAddress: true,
        user: { select: { phone: true, firstName: true } },
      },
    });

    if (!ride?.user?.phone) return;

    const msg = `✅ *You've been picked up!*\n\n`
      + `📋 Ride #${ride.id}\n`
      + `📍 Heading to: ${ride.dropoffAddress}\n\n`
      + `Enjoy your ride! 🚕`;

    await sendTemplateOrText(ride.user.phone, 'ride_picked_up', [
      String(ride.id),
      ride.dropoffAddress,
    ], msg);
  } catch (e) {
    logWAError('[WA Notify] Picked up error:', e);
  }
}

/**
 * Notify customer that ride is completed + send receipt link
 */
export async function notifyCustomerCompleted(rideId: number, invoiceId: number) {
  try {
    const ride = await prisma.ride.findUnique({
      where: { id: rideId },
      select: {
        id: true,
        price: true,
        paymentMethod: true,
        user: { select: { phone: true, firstName: true, email: true } },
      },
    });

    if (!ride?.user?.phone) return;

    const baseUrl = process.env.PUBLIC_BASE_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const invoiceLink = `${baseUrl}/invoice/${invoiceId}`;

    const priceDisplay = Number(ride.price).toFixed(2);
    const paymentMethod = ride.paymentMethod === 'cash' ? 'Cash' : 'Card';

    const msg = `🏁 *Ride completed!*\n\n`
      + `📋 Ride #${ride.id}\n`
      + `💰 Price: ${priceDisplay} DKK\n`
      + `💵 Payment: ${paymentMethod}\n\n`
      + `🧾 *Receipt:* ${invoiceLink}\n\n`
      + `Thank you for choosing 944 Trafik! 🚕`;

    await sendTemplateOrText(ride.user.phone, 'ride_completed', [
      String(ride.id),
      priceDisplay,
      invoiceLink,
    ], msg);
  } catch (e) {
    logWAError('[WA Notify] Completed error:', e);
  }
}
