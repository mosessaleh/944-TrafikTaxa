import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getUserFromCookie } from '@/lib/auth';
import { validateRequestOrigin } from '@/lib/security-headers';

export async function POST(
  request: NextRequest,
) {
  try {
    const originCheck = validateRequestOrigin(request);
    if (!originCheck.ok) {
      return NextResponse.json(
        { error: 'Invalid request origin' },
        { status: 403 }
      );
    }

    const me = await getUserFromCookie();
    if (!me || me.type !== 'user' || (me as any).role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { table } = await request.json();
    
    if (!table) {
      return NextResponse.json({ error: 'Table name is required' }, { status: 400 });
    }

    // Allowed tables for clearing (excluding protected tables)
    const allowedTables = [
      'ride', 'invoice', 'complaint', 'favoriteAddress', 'paymentMethod',
      'cryptoPayment', 'cardPayment', 'paypalPayment', 'revolutPayment',
      'cryptoWallet', 'auditLog'
    ];

    const excludedTables = ['user', 'vehicleType', 'settings', '_prisma_migrations'];

    if (excludedTables.includes(table)) {
      return NextResponse.json({
        error: `Cannot clear protected table: ${table}`
      }, { status: 400 });
    }

    if (!allowedTables.includes(table)) {
      return NextResponse.json({
        error: `Table "${table}" is not available for clearing`
      }, { status: 400 });
    }

    // Map table names to Prisma model names
    const modelMap: { [key: string]: string } = {
      'ride': 'ride',
      'invoice': 'invoice',
      'complaint': 'complaint',
      'favoriteAddress': 'favoriteAddress',
      'paymentMethod': 'paymentMethod',
      'cryptoPayment': 'cryptoPayment',
      'cardPayment': 'cardPayment',
      'paypalPayment': 'payPalPayment',
      'revolutPayment': 'revolutPayment',
      'cryptoWallet': 'cryptoWallet',
      'auditLog': 'auditLog'
    };

    const modelName = modelMap[table];
    if (!modelName) {
      return NextResponse.json({ error: 'Invalid table mapping' }, { status: 400 });
    }

    // Execute the clear operation based on the model
    let result;
    let cascadeInfo: { complaints?: number; invoices?: number } = {};
    
    switch (modelName) {
      case 'ride':
        // Delete dependent records first to avoid foreign key constraint violations
        console.log('Deleting dependent complaints and invoices...');
        const complaintsResult = await prisma.complaint.deleteMany({});
        const invoicesResult = await prisma.invoice.deleteMany({});
        console.log(`Deleted ${complaintsResult.count} complaints and ${invoicesResult.count} invoices`);
        
        cascadeInfo = {
          complaints: complaintsResult.count,
          invoices: invoicesResult.count
        };
        
        result = await prisma.ride.deleteMany({});
        console.log(`Deleted ${result.count} rides`);
        break;
      case 'invoice':
        result = await prisma.invoice.deleteMany({});
        break;
      case 'complaint':
        result = await prisma.complaint.deleteMany({});
        break;
      case 'favoriteAddress':
        result = await prisma.favoriteAddress.deleteMany({});
        break;
      case 'paymentMethod':
        result = await prisma.paymentMethod.deleteMany({});
        break;
      case 'cryptoPayment':
        result = await prisma.cryptoPayment.deleteMany({});
        break;
      case 'cardPayment':
        result = await prisma.cardPayment.deleteMany({});
        break;
      case 'payPalPayment':
        result = await prisma.payPalPayment.deleteMany({});
        break;
      case 'revolutPayment':
        result = await prisma.revolutPayment.deleteMany({});
        break;
      case 'cryptoWallet':
        result = await prisma.cryptoWallet.deleteMany({});
        break;
      case 'auditLog':
        result = await prisma.auditLog.deleteMany({});
        break;
      default:
        return NextResponse.json({ error: 'Model not found' }, { status: 400 });
    }

    console.log(`Cleared data from ${table}:`, result);

    return NextResponse.json({
      success: true,
      message: table === 'ride'
        ? `Successfully cleared ${result.count} rides (including ${cascadeInfo.complaints} complaints and ${cascadeInfo.invoices} invoices)`
        : `Successfully cleared ${result.count} records from ${table}`,
      table,
      deletedCount: result.count
    });

  } catch (error) {
    console.error('Error clearing data:', error);
    return NextResponse.json(
      { error: 'Failed to clear data' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
) {
  try {
    const originCheck = validateRequestOrigin(request);
    if (!originCheck.ok) {
      return NextResponse.json(
        { error: 'Invalid request origin' },
        { status: 403 }
      );
    }

    const me = await getUserFromCookie();
    if (!me || me.type !== 'user' || (me as any).role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get record counts for all clearable tables
    const counts = await Promise.all([
      prisma.ride.count(),
      prisma.invoice.count(),
      prisma.complaint.count(),
      prisma.favoriteAddress.count(),
      prisma.paymentMethod.count(),
      prisma.cryptoPayment.count(),
      prisma.cardPayment.count(),
      prisma.payPalPayment.count(),
      prisma.revolutPayment.count(),
      prisma.cryptoWallet.count(),
      prisma.auditLog.count()
    ]);

    const tableCounts = [
      { name: 'ride', count: counts[0] },
      { name: 'invoice', count: counts[1] },
      { name: 'complaint', count: counts[2] },
      { name: 'favoriteAddress', count: counts[3] },
      { name: 'paymentMethod', count: counts[4] },
      { name: 'cryptoPayment', count: counts[5] },
      { name: 'cardPayment', count: counts[6] },
      { name: 'paypalPayment', count: counts[7] },
      { name: 'revolutPayment', count: counts[8] },
      { name: 'cryptoWallet', count: counts[9] },
      { name: 'auditLog', count: counts[10] }
    ];

    return NextResponse.json({
      success: true,
      tables: tableCounts
    });

  } catch (error) {
    console.error('Error getting table counts:', error);
    return NextResponse.json(
      { error: 'Failed to get table counts' },
      { status: 500 }
    );
  }
}