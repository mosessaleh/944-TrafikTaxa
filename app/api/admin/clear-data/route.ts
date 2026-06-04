import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requirePermission } from '@/lib/auth';
import { validateRequestOrigin } from '@/lib/security-headers';
import { AuditEvent, AuditLogger } from '@/lib/audit-log';

function dangerZoneEnabled() {
  return process.env.NODE_ENV !== 'production' || process.env.ENABLE_ADMIN_DANGER_ZONE === 'true';
}

export async function POST(
  request: NextRequest,
) {
  try {
    if (!dangerZoneEnabled()) {
      return NextResponse.json(
        { error: 'Danger zone is disabled in production' },
        { status: 403 }
      );
    }

    const originCheck = validateRequestOrigin(request);
    if (!originCheck.ok) {
      return NextResponse.json(
        { error: 'Invalid request origin' },
        { status: 403 }
      );
    }

    const me = await requirePermission('danger.manage');

    const { table } = await request.json();
    
    if (!table) {
      return NextResponse.json({ error: 'Table name is required' }, { status: 400 });
    }

    // Allowed tables for clearing (excluding protected tables)
    const allowedTables = [
      'ride', 'invoice', 'complaint', 'favoriteaddress', 'paymentMethod',
      'cryptoPayment', 'cardPayment', 'paypalPayment', 'revolutPayment',
      'cryptoWallet'
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
      'favoriteaddress': 'favoriteaddress',
      'paymentMethod': 'paymentMethod',
      'cryptoPayment': 'cryptoPayment',
      'cardPayment': 'cardPayment',
      'paypalPayment': 'payPalPayment',
      'revolutPayment': 'revolutPayment',
      'cryptoWallet': 'cryptoWallet',
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
      case 'favoriteaddress':
        result = await prisma.favoriteaddress.deleteMany({});
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
      default:
        return NextResponse.json({ error: 'Model not found' }, { status: 400 });
    }

    await AuditLogger.log({
      event: AuditEvent.ADMIN_ACTION,
      userId: String((me as any).id),
      ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('cf-connecting-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
      metadata: { action: 'clear_data', table, deletedCount: result.count, cascadeInfo },
      severity: 'critical'
    });

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
    if (!dangerZoneEnabled()) {
      return NextResponse.json(
        { error: 'Danger zone is disabled in production' },
        { status: 403 }
      );
    }

    const originCheck = validateRequestOrigin(request);
    if (!originCheck.ok) {
      return NextResponse.json(
        { error: 'Invalid request origin' },
        { status: 403 }
      );
    }

    await requirePermission('danger.manage');

    // Get record counts for all clearable tables
    const getCount = async (model: any, name: string) => {
      try {
        return await model.count();
      } catch (error) {
        console.error(`Error counting ${name}:`, error);
        return 0;
      }
    };

    const tableCounts = await Promise.all([
      getCount(prisma.ride, 'ride'),
      getCount(prisma.invoice, 'invoice'),
      getCount(prisma.complaint, 'complaint'),
      getCount(prisma.favoriteaddress, 'favoriteaddress'),
      getCount(prisma.paymentMethod, 'paymentMethod'),
      getCount(prisma.cryptoPayment, 'cryptoPayment'),
      getCount(prisma.cardPayment, 'cardPayment'),
      getCount(prisma.payPalPayment, 'paypalPayment'),
      getCount(prisma.revolutPayment, 'revolutPayment'),
      getCount(prisma.cryptoWallet, 'cryptoWallet')
    ].map(async (promise, index) => {
      const count = await promise;
      const names = ['ride', 'invoice', 'complaint', 'favoriteaddress', 'paymentMethod', 'cryptoPayment', 'cardPayment', 'paypalPayment', 'revolutPayment', 'cryptoWallet'];
      return { name: names[index], count };
    }));

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
