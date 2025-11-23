import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { validateRequestOrigin } from '@/lib/security-headers';

const UpdateSchema = z.object({
  comId: z.number().int().positive().optional(),
  cpr: z.string().min(1).optional(),
  drFname: z.string().min(1).optional(),
  drLname: z.string().min(1).optional(),
  sex: z.enum(['MALE', 'FEMALE']).optional(),
  drAddress: z.string().min(1).optional(),
  drPhone: z.string().min(1).optional(),
  drEmail: z.string().optional().refine((val) => val == null || val === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val), "Invalid email format"),
  licenceNr: z.string().min(1).optional(),
  drCard: z.string().min(1).optional(),
  rating: z.number().min(0).max(5).optional(),
  isOnline: z.boolean().optional(),
  isActive: z.boolean().optional(),
  car: z.string().optional(),
  currentRideId: z.number().int().optional(),
  drUsername: z.string().min(1).optional(),
  drPass: z.string().min(8).optional(),
});

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const originCheck = validateRequestOrigin(req);
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

    const body = await req.json();
    const parsed = UpdateSchema.safeParse(body);
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      return NextResponse.json({ ok: false, error: 'Validation failed', details: fieldErrors }, { status: 400 });
    }
    const data = parsed.data;

    // Check if driver exists
    const existing = await prisma.comDriver.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ ok: false, error: 'Driver not found' }, { status: 404 });
    }

    // Check unique constraints if updating
    if (data.drUsername && data.drUsername !== existing.drUsername) {
      const existingUsername = await prisma.comDriver.findUnique({ where: { drUsername: data.drUsername } });
      if (existingUsername) {
        return NextResponse.json({ ok: false, error: 'Username already exists' }, { status: 409 });
      }
    }

    let updateData: any = { ...data };
    if (data.drPass) {
      updateData.drPass = await hashPassword(data.drPass);
    }

    const driver = await prisma.comDriver.update({
      where: { id },
      data: updateData,
      include: {
        company: {
          select: {
            comName: true,
          },
        },
      },
    });

    return NextResponse.json({ ok: true, data: driver });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Failed to update driver' }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const originCheck = validateRequestOrigin(req);
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

    const existing = await prisma.comDriver.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ ok: false, error: 'Driver not found' }, { status: 404 });
    }

    await prisma.comDriver.delete({ where: { id } });

    return NextResponse.json({ ok: true, message: 'Driver deleted successfully' });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Failed to delete driver' }, { status: 500 });
  }
}