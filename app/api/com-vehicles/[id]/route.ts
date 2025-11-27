import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { validateRequestOrigin } from '@/lib/security-headers';

const UpdateSchema = z.object({
  comId: z.number().int().positive().optional(),
  uId: z.union([z.number().int(), z.null()]).optional(),
  vehicleType: z.union([z.string(), z.null()]).optional(),
  regNumber: z.string().min(1).optional(),
  make: z.string().min(1).optional(),
  model: z.string().min(1).optional(),
  variant: z.union([z.string(), z.null()]).optional(),
  year: z.union([z.number().int(), z.null()]).optional(),
  vinNumber: z.union([z.string(), z.null()]).optional(),
  seats: z.union([z.number().int(), z.null()]).optional(),
  color: z.union([z.string(), z.null()]).optional(),
  fuel: z.union([z.string(), z.null()]).optional(),
  status: z.number().int().optional(),
  taxiPermitNumber: z.string().min(1).optional(),
  notes: z.union([z.string(), z.null()]).optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: "At least one field must be provided for update"
});

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    // Require admin authentication
    await requireAdmin();

    const id = parseInt(params.id);
    if (isNaN(id)) {
      return NextResponse.json({ ok: false, error: 'Invalid ID' }, { status: 400 });
    }

    const vehicle = await prisma.comVehicles.findUnique({
      where: { id },
      include: {
        company: {
          select: {
            comName: true,
          },
        },
      },
    });

    if (!vehicle) {
      return NextResponse.json({ ok: false, error: 'Vehicle not found' }, { status: 404 });
    }

    return NextResponse.json({ ok: true, data: vehicle });
  } catch (e: any) {
    if (e.status === 401 || e.status === 403) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: e.status });
    }
    return NextResponse.json({ ok: false, error: e?.message || 'Failed to fetch vehicle' }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const originCheck = validateRequestOrigin(request);
    if (!originCheck.ok) {
      return NextResponse.json(
        { ok: false, error: 'Invalid request origin' },
        { status: 403 }
      );
    }

    const id = parseInt(params.id);
    if (isNaN(id)) {
      return NextResponse.json({ ok: false, error: 'Invalid ID' }, { status: 400 });
    }

    const body = await request.json();
    const parsed = UpdateSchema.safeParse(body);
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      return NextResponse.json({ ok: false, error: 'Validation failed', details: fieldErrors }, { status: 400 });
    }
    const data = parsed.data;

    // Check if vehicle exists
    const existingVehicle = await prisma.comVehicles.findUnique({ where: { id } });
    if (!existingVehicle) {
      return NextResponse.json({ ok: false, error: 'Vehicle not found' }, { status: 404 });
    }

    // Check if registration number is unique (if being changed)
    if (data.regNumber && data.regNumber !== existingVehicle.regNumber) {
      const duplicateVehicle = await prisma.comVehicles.findFirst({
        where: { regNumber: data.regNumber }
      });
      if (duplicateVehicle) {
        return NextResponse.json({ ok: false, error: 'Registration number already exists' }, { status: 409 });
      }
    }

    // Check if company exists (if being changed)
    if (data.comId && data.comId !== existingVehicle.comId) {
      const company = await prisma.partnerCompany.findUnique({ where: { id: data.comId } });
      if (!company) {
        return NextResponse.json({ ok: false, error: 'Company not found' }, { status: 404 });
      }
    }

    const vehicle = await prisma.comVehicles.update({
      where: { id },
      data: {
        comId: data.comId,
        uId: data.uId,
        vehicleType: data.vehicleType,
        regNumber: data.regNumber,
        make: data.make,
        model: data.model,
        variant: data.variant,
        year: data.year,
        vinNumber: data.vinNumber,
        seats: data.seats,
        color: data.color,
        fuel: data.fuel,
        status: data.status,
        taxiPermitNumber: data.taxiPermitNumber,
        notes: data.notes,
      },
      include: {
        company: {
          select: {
            comName: true,
          },
        },
      },
    });

    return NextResponse.json({ ok: true, data: vehicle });
  } catch (e: any) {
    console.error('Failed to update vehicle:', e?.stack || e?.message || e);
    return NextResponse.json({ ok: false, error: e?.message || 'Failed to update vehicle' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const originCheck = validateRequestOrigin(request);
    if (!originCheck.ok) {
      return NextResponse.json(
        { ok: false, error: 'Invalid request origin' },
        { status: 403 }
      );
    }

    const id = parseInt(params.id);
    if (isNaN(id)) {
      return NextResponse.json({ ok: false, error: 'Invalid ID' }, { status: 400 });
    }

    // Check if vehicle exists
    const existingVehicle = await prisma.comVehicles.findUnique({ where: { id } });
    if (!existingVehicle) {
      return NextResponse.json({ ok: false, error: 'Vehicle not found' }, { status: 404 });
    }

    await prisma.comVehicles.delete({ where: { id } });

    return NextResponse.json({ ok: true, message: 'Vehicle deleted successfully' });
  } catch (e: any) {
    console.error('Failed to delete vehicle:', e?.stack || e?.message || e);
    return NextResponse.json({ ok: false, error: e?.message || 'Failed to delete vehicle' }, { status: 500 });
  }
}