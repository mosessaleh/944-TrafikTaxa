import { prisma } from '@/lib/db';

const WHATSAPP_API_VERSION = 'v22.0';

let cachedPhoneId = '';
let cachedToken = '';

function getWACreds() {
  if (!cachedPhoneId) {
    cachedPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
    cachedToken = process.env.WHATSAPP_ACCESS_TOKEN || '';
  }
  return { phoneId: cachedPhoneId, token: cachedToken };
}

async function sendMessage(to: string, text: string) {
  const { phoneId, token } = getWACreds();
  if (!phoneId || !token) return;

  try {
    await fetch(`https://graph.facebook.com/${WHATSAPP_API_VERSION}/${phoneId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to, type: 'text', text: { preview_url: false, body: text } }),
    });
  } catch (e) {
    console.error('[WA Notify] Send failed:', e);
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

    await sendMessage(ride.user.phone, msg);
  } catch (e) {
    console.error('[WA Notify] Driver accepted error:', e);
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

    await sendMessage(ride.user.phone, msg);
  } catch (e) {
    console.error('[WA Notify] Picked up error:', e);
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

    await sendMessage(ride.user.phone, msg);
  } catch (e) {
    console.error('[WA Notify] Completed error:', e);
  }
}