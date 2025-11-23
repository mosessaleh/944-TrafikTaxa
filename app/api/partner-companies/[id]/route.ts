import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { validateRequestOrigin } from '@/lib/security-headers';

const UpdateSchema = z.object({
  cvr: z.string().optional(),
  comName: z.string().min(1).optional(),
  contactPerson: z.string().min(1).optional(),
  comAddress: z.string().min(1).optional(),
  comPhone: z.string().min(1).optional(),
  comEmail: z.string().optional().refine((val) => val == null || val === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val), "Invalid email format"),
  comBankInfo: z.string().optional(),
  comStatus: z.boolean().optional(),
  commissionRate: z.number().min(0).optional(),
  contractSigned: z.boolean().optional(),
  comUserName: z.string().min(1).optional(),
  comPass: z.string().min(8).optional()
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

    // Check if partner exists
    const existing = await prisma.partnerCompany.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ ok: false, error: 'Partner not found' }, { status: 404 });
    }

    // Check unique constraints if updating
    if (data.cvr && data.cvr !== existing.cvr) {
      const existingCvr = await prisma.partnerCompany.findUnique({ where: { cvr: data.cvr } });
      if (existingCvr) return NextResponse.json({ ok: false, error: 'CVR already exists' }, { status: 409 });
    }

    if (data.comUserName && data.comUserName !== existing.comUserName) {
      const existingUserName = await prisma.partnerCompany.findUnique({ where: { comUserName: data.comUserName } });
      if (existingUserName) return NextResponse.json({ ok: false, error: 'Username already exists' }, { status: 409 });
    }

    let updateData: any = { ...data };
    if (data.comPass) {
      updateData.comPass = await hashPassword(data.comPass);
    }

    const partner = await prisma.partnerCompany.update({
      where: { id },
      data: updateData
    });

    return NextResponse.json({ ok: true, data: partner });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Failed to update partner' }, { status: 500 });
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

    const existing = await prisma.partnerCompany.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ ok: false, error: 'Partner not found' }, { status: 404 });
    }

    await prisma.partnerCompany.delete({ where: { id } });

    return NextResponse.json({ ok: true, message: 'Partner deleted successfully' });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Failed to delete partner' }, { status: 500 });
  }
}