import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { validateRequestOrigin } from '@/lib/security-headers';

const CreateSchema = z.object({
  comId: z.number().int().positive(),
  uId: z.number().int().optional(),
  vehicleType: z.string().min(1),
  regNumber: z.string().min(1),
  make: z.string().optional(),
  model: z.string().optional(),
  variant: z.string().optional(),
  year: z.number().int().optional(),
  vinNumber: z.string().optional(),
  seats: z.number().int().optional(),
  color: z.string().optional(),
  fuel: z.string().optional(),
  status: z.number().int().default(0),
  taxiPermitNumber: z.string().min(1),
  notes: z.string().min(1),
});

export async function GET(request: Request) {
  try {
    // Require admin authentication
    await requireAdmin();

    const vehicles = await prisma.comVehicles.findMany({
      include: {
        company: {
          select: {
            comName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({ ok: true, data: vehicles });
  } catch (e: any) {
    if (e.status === 401 || e.status === 403) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: e.status });
    }
    return NextResponse.json({ ok: false, error: e?.message || 'Failed to fetch vehicles' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const originCheck = validateRequestOrigin(req);
    if (!originCheck.ok) {
      return NextResponse.json(
        { ok: false, error: 'Invalid request origin' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parsed = CreateSchema.safeParse(body);
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      return NextResponse.json({ ok: false, error: 'Validation failed', details: fieldErrors }, { status: 400 });
    }
    const data = parsed.data;

    // Check if company exists
    const company = await prisma.partnerCompany.findUnique({ where: { id: data.comId } });
    if (!company) {
      return NextResponse.json({ ok: false, error: 'Company not found' }, { status: 404 });
    }

    // Check if registration number is unique
    const existingVehicle = await prisma.comVehicles.findFirst({ where: { regNumber: data.regNumber } });
    if (existingVehicle) {
      return NextResponse.json({ ok: false, error: 'Registration number already exists' }, { status: 409 });
    }

    const vehicle = await prisma.comVehicles.create({
      data: {
        comId: data.comId,
        uId: data.uId,
        vehicleType: data.vehicleType,
        regNumber: data.regNumber,
        make: data.make || '',
        model: data.model || '',
        variant: data.variant || '',
        year: data.year,
        vinNumber: data.vinNumber,
        seats: data.seats,
        color: data.color,
        fuel: data.fuel,
        status: data.status,
        taxiPermitNumber: data.taxiPermitNumber,
        notes: data.notes,
      }
    });

    return NextResponse.json({ ok: true, data: vehicle }, { status: 201 });
  } catch (e: any) {
    console.error('Failed to create vehicle:', e?.stack || e?.message || e);
    return NextResponse.json({ ok: false, error: e?.message || 'Failed to create vehicle' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  return NextResponse.json({ ok: false, error: 'Use /api/com-vehicles/[id] for updates' }, { status: 400 });
}

export async function DELETE(req: Request) {
  return NextResponse.json({ ok: false, error: 'Use /api/com-vehicles/[id] for deletions' }, { status: 400 });
}