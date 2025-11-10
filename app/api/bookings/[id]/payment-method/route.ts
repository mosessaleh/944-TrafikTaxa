import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getUserFromCookie } from '@/lib/auth';
import { notifyUserInvoiceReady } from '@/lib/notify';
import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const me = await getUserFromCookie();
    if (!me) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const bookingId = parseInt(params.id);
    if (isNaN(bookingId)) {
      return NextResponse.json({ error: 'Invalid booking ID' }, { status: 400 });
    }

    const { paymentMethod } = await request.json();
    if (!paymentMethod) {
      return NextResponse.json({ error: 'Payment method required' }, { status: 400 });
    }

    // Check if user owns this booking or is admin
    const booking = await prisma.ride.findUnique({
      where: { id: bookingId },
      select: { userId: true }
    });

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    if (booking.userId !== me.id && me.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Special handling for invoice payment
    let updatedBooking;
    if (paymentMethod === 'invoice') {
      if (!(me as any).canPayByInvoice && me.role !== 'ADMIN') {
        return NextResponse.json({
          error: 'Invoice payment not available for your account'
        }, { status: 403 });
      }

      // Get full booking details for invoice generation
      const fullBooking = await prisma.ride.findUnique({
        where: { id: bookingId },
        include: {
          user: true,
          vehicleType: true
        }
      });

      if (!fullBooking) {
        return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
      }

      // Create invoices directory structure: public/invoices/userId/invoiceNumber/
      const invoicesDir = path.join(process.cwd(), 'public', 'invoices');
      const userInvoicesDir = path.join(invoicesDir, fullBooking.userId.toString());
      const invoiceNumber = `INV-${fullBooking.id.toString().padStart(6, '0')}`;
      const invoiceDir = path.join(userInvoicesDir, invoiceNumber);

      if (!fs.existsSync(invoicesDir)) {
        fs.mkdirSync(invoicesDir, { recursive: true });
      }
      if (!fs.existsSync(userInvoicesDir)) {
        fs.mkdirSync(userInvoicesDir, { recursive: true });
      }
      if (!fs.existsSync(invoiceDir)) {
        fs.mkdirSync(invoiceDir, { recursive: true });
      }

      // Generate invoice
      const filename = `${invoiceNumber}.pdf`;
      const filePath = path.join(invoiceDir, filename);

      // Generate professional Danish HTML invoice content
      const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Invoice ${invoiceNumber}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: 'Arial', sans-serif;
            font-size: 12px;
            line-height: 1.4;
            color: #333;
            background: white;
            -webkit-print-color-adjust: exact;
            color-adjust: exact;
        }
        .invoice-container {
            width: 210mm;
            min-height: 297mm;
            margin: 0 auto;
            padding: 20mm;
            position: relative;
        }
        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 2px solid #000;
        }
        .company-info {
            flex: 1;
        }
        .company-info h1 {
            font-size: 18px;
            font-weight: bold;
            color: #000;
            margin-bottom: 5px;
        }
        .company-details {
            font-size: 10px;
            color: #666;
            line-height: 1.3;
        }
        .logo {
            width: 120px;
            height: auto;
            opacity: 1;
        }
        .invoice-meta {
            display: flex;
            justify-content: space-between;
            margin: 30px 0;
        }
        .meta-section {
            flex: 1;
        }
        .meta-section:first-child {
            margin-right: 50px;
        }
        .meta-section p {
            margin-bottom: 3px;
            font-size: 11px;
        }
        .meta-section .address {
            margin-top: 8px;
            font-style: italic;
            color: #666;
        }
        .service-table {
            width: 100%;
            border-collapse: collapse;
            margin: 30px 0;
            border: 1px solid #ddd;
        }
        .service-table th {
            background: #000;
            color: white;
            padding: 12px;
            text-align: left;
            font-weight: bold;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .service-table td {
            padding: 12px;
            border-bottom: 1px solid #eee;
            font-size: 11px;
        }
        .service-table .description {
            font-weight: bold;
        }
        .service-table .description small {
            display: block;
            font-weight: normal;
            color: #666;
            margin-top: 3px;
            font-size: 10px;
        }
        .total-section {
            background: white;
            color: #000;
            padding: 20px;
            text-align: right;
            margin: 30px 0;
            border: none;
        }
        .total-section h3 {
            font-size: 18px;
            margin-bottom: 5px;
        }
        .total-section p {
            font-size: 10px;
            opacity: 0.9;
        }
        .payment-section {
            background: #f8f8f8;
            padding: 20px;
            margin: 50px 0 30px 0;
            border-radius: 5px;
        }
        .payment-section h3 {
            font-size: 14px;
            margin-bottom: 15px;
            color: #000;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .payment-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
        }
        .payment-item {
            background: white;
            padding: 12px;
            border-radius: 3px;
            border-left: 3px solid #000;
        }
        .payment-item strong {
            font-size: 10px;
            color: #666;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            display: block;
            margin-bottom: 3px;
        }
        .payment-item div {
            font-size: 12px;
            font-weight: bold;
            color: #000;
        }
        .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
            text-align: center;
            font-size: 10px;
            color: #666;
        }
        .footer p {
            margin-bottom: 5px;
        }
        @media print {
            body {
                font-size: 11px;
            }
            .invoice-container {
                margin: 0;
                padding: 15mm;
            }
        }
    </style>
</head>
<body>
    <div class="invoice-container">
        <div class="header">
            <div class="company-info">
                <h1>944 TRAFIK</h1>
                <div class="company-details">
                    Maglehøjparken 137<br>
                    3600 Frederikssund<br>
                    CVR: 40841725
                </div>
            </div>
            <img src="/logo.svg" alt="944 Trafik Logo" class="logo">
        </div>

        <div class="invoice-meta">
            <div class="meta-section">
                <p><strong>${fullBooking.user.firstName} ${fullBooking.user.lastName}</strong></p>
                <p class="address">${fullBooking.user.address || 'Adressen er ikke fundet'}</p>
            </div>
            <div class="meta-section">
                <p><strong>Dato:</strong> ${new Date().toLocaleDateString('en-DK')}</p>
                <p><strong>Forfaldsdato:</strong> ${new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toLocaleDateString('en-DK')}</p>
                <p><strong>Faktura:</strong> ${invoiceNumber}</p>
            </div>
        </div>

        <table class="service-table">
            <thead>
                <tr>
                    <th style="width: 50%;">Beskrivelse</th>
                    <th style="width: 15%;">Antal</th>
                    <th style="width: 20%;">Enhedspris</th>
                    <th style="width: 15%;">Pris</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td class="description">
                        Bestilling nr: #${fullBooking.id} - ${fullBooking.vehicleType.title}
                        <small>
                            Fra: ${fullBooking.pickupAddress}<br>
                            Til: ${fullBooking.dropoffAddress}
                        </small>
                    </td>
                    <td>1</td>
                    <td>${fullBooking.price.toLocaleString('da-DK')} DKK</td>
                    <td><strong>${fullBooking.price.toLocaleString('da-DK')} DKK</strong></td>
                </tr>
            </tbody>
        </table>

        <div class="total-section">
            <h3>Subtotal momsfrit: ${fullBooking.price.toLocaleString('da-DK')} DKK</h3>
        </div>
        <br />
        <br />
        <br />
        <br />
        <div class="payment-section">
            <h3>Betaling oplysninger</h3>
            <div class="payment-grid">
                <div class="payment-item">
                    <strong>Bank oplysninger</strong>
                    <div>1234-12345678</div>
                </div>
                <div class="payment-item">
                    <strong>Reference</strong>
                    <div>Fkt. #${fullBooking.id}</div>
                </div>
                <div class="payment-item">
                    <strong>Forfaldsdato</strong>
                    <div>${new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toLocaleDateString('en-DK')}</div>
                </div>
            </div>
        </div>

        <div class="footer">
            <p><strong>944 Trafik</strong> - Professional Taxa Service i Danmark</p>
            <p>Har du spørgsmål?, kontakt os på trafik@944.dk eller ring til +45 26 44 49 44</p>
        </div>
    </div>
</body>
</html>`;

      // Generate PDF from HTML using Puppeteer
      const browser = await puppeteer.launch({ headless: true });
      const page = await browser.newPage();
      await page.setContent(htmlContent);
      const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
      await browser.close();

      // Write the PDF buffer to file
      fs.writeFileSync(filePath, pdfBuffer);

      // Send invoice email notification with attachment
      await notifyUserInvoiceReady(fullBooking.user.email, fullBooking.user.firstName, {
        bookingId: fullBooking.id,
        price: fullBooking.price,
      }, filePath).catch((error) => {
        console.error('Failed to send invoice email:', error);
      });

      // Update payment method and set status to CONFIRMED and paymentStatus to PENDING
      updatedBooking = await (prisma as any).ride.update({
        where: { id: bookingId },
        data: {
          paymentMethod,
          status: 'CONFIRMED',
          paymentStatus: 'PENDING',
          explanation: 'Invoice sent - Payment due within 8 days. Account: 1234-12345678'
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
    } else {
      // Update payment method only for other methods
      updatedBooking = await (prisma as any).ride.update({
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
    }

    return NextResponse.json({
      success: true,
      booking: {
        id: updatedBooking.id,
        status: updatedBooking.status
      }
    });

  } catch (error) {
    console.error('Error updating payment method:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}