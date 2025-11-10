import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getUserFromCookie } from '@/lib/auth';
import { sendEmail } from '@/lib/email';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const me = await getUserFromCookie();
    if (!me || me.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const invoiceId = parseInt(params.id);
    if (isNaN(invoiceId)) {
      return NextResponse.json({ error: 'Invalid invoice ID' }, { status: 400 });
    }

    const invoice = await (prisma as any).invoice.findUnique({
      where: { id: invoiceId },
      include: {
        user: true,
        ride: {
          include: {
            vehicleType: true,
          },
        },
      },
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // Send reminder email
    const subject = `Påmindelse: Ubetalt faktura ${invoice.invoiceNumber}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Påmindelse om ubetalt faktura</h2>
        <p>Kære ${invoice.user.firstName} ${invoice.user.lastName},</p>
        <p>Vi sender denne påmindelse fordi du har en ubetalt faktura hos 944 Trafik.</p>
        <div style="background: #f5f5f5; padding: 20px; margin: 20px 0; border-radius: 5px;">
          <p><strong>Faktura nummer:</strong> ${invoice.invoiceNumber}</p>
          <p><strong>Bestilling ID:</strong> #${invoice.rideId}</p>
          <p><strong>Forfaldsdato:</strong> ${invoice.dueDate.toLocaleDateString('da-DK')}</p>
          <p><strong>Beløb:</strong> ${invoice.ride.price.toLocaleString('da-DK')} DKK</p>
        </div>
        <p>Du kan betale fakturaen ved at logge ind på din konto og følge betalingsinstruktionerne.</p>
        <p>Hvis du allerede har betalt, bedes du ignorere denne påmindelse.</p>
        <p>Med venlig hilsen,<br>944 Trafik Team</p>
      </div>
    `;

    await sendEmail(invoice.user.email, subject, html);

    return NextResponse.json({ success: true, message: 'Reminder sent successfully' });
  } catch (error) {
    console.error('Error sending reminder:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}