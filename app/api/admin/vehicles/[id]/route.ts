import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requirePermission } from '@/lib/auth';

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    await requirePermission('drivers.read');

    const vehicleId = parseInt(params.id);
    if (isNaN(vehicleId)) {
      return NextResponse.json({ error: 'Invalid vehicle ID' }, { status: 400 });
    }

    const vehicle = await prisma.comVehicles.findUnique({
      where: { id: vehicleId },
      select: {
        id: true,
        regNumber: true,
        make: true,
        model: true,
        year: true,
        color: true
      }
    });

    if (!vehicle) {
      return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 });
    }

    return NextResponse.json({ vehicle });

  } catch (error) {
    console.error('Error fetching vehicle:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
