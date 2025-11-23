import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { validateRequestOrigin } from '@/lib/security-headers';

const CreateSchema = z.object({
  cvr: z.string().min(1),
  comName: z.string().min(1),
  contactPerson: z.string().min(1),
  comAddress: z.string().min(1),
  comPhone: z.string().min(1),
  comEmail: z.string().optional().refine((val) => val == null || val === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val), "Invalid email format"),
  comBankInfo: z.string().min(1),
  comStatus: z.boolean().default(false),
  commissionRate: z.number().min(0).default(0),
  contractSigned: z.boolean().default(false),
  comUserName: z.string().min(1),
  comPass: z.string().min(8)
});

export async function GET() {
  try {
    const partners = await prisma.partnerCompany.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        cvr: true,
        comName: true,
        contactPerson: true,
        comAddress: true,
        comPhone: true,
        comEmail: true,
        comBankInfo: true,
        comStatus: true,
        commissionRate: true,
        contractSigned: true,
        comUserName: true,
        createdAt: true,
        updatedAt: true,
      }
    });
    return NextResponse.json({ ok: true, data: partners });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Failed to fetch partners' }, { status: 500 });
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

    // Check unique constraints
    const existingCvr = await prisma.partnerCompany.findUnique({ where: { cvr: data.cvr } });
    if (existingCvr) return NextResponse.json({ ok: false, error: 'CVR already exists' }, { status: 409 });

    const existingUserName = await prisma.partnerCompany.findUnique({ where: { comUserName: data.comUserName } });
    if (existingUserName) return NextResponse.json({ ok: false, error: 'Username already exists' }, { status: 409 });

    const hashedPassword = await hashPassword(data.comPass);

    const partner = await prisma.partnerCompany.create({
      data: {
        cvr: data.cvr,
        comName: data.comName,
        contactPerson: data.contactPerson,
        comAddress: data.comAddress,
        comPhone: data.comPhone,
        comEmail: data.comEmail,
        comBankInfo: data.comBankInfo,
        comStatus: data.comStatus,
        commissionRate: data.commissionRate,
        contractSigned: data.contractSigned,
        comUserName: data.comUserName,
        comPass: hashedPassword
      }
    });

    return NextResponse.json({ ok: true, data: partner }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Failed to create partner' }, { status: 500 });
  }
}