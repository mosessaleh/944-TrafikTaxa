import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { hashPassword, requireAdmin } from '@/lib/auth';
import { validateRequestOrigin } from '@/lib/security-headers';
import { encryptCPR, decryptCPR } from '@/lib/crypto';
import { AuditLogger, AuditEvent } from '@/lib/audit-log';
import { randomUUID } from 'crypto';

const CreateSchema = z.object({
  comId: z.number().int().positive(),
  cpr: z.string().min(1),
  drFname: z.string().min(1),
  drLname: z.string().min(1),
  sex: z.enum(['MALE', 'FEMALE']),
  drAddress: z.string().min(1),
  drPhone: z.string().min(1),
  drEmail: z.string().email().optional(),
  drPhoto: z.string().optional(),
  licenceNr: z.string().min(1),
  drCard: z.string().min(1),
  rating: z.number().min(0).max(5).default(5.00),
  isOnline: z.boolean().default(false),
  isActive: z.boolean().default(true),
  car: z.string().optional(),
  currentRideId: z.number().int().optional(),
  drUsername: z.string().min(1),
  drPass: z.string().min(8),
  lastLocation: z.object({
    lat: z.number(),
    lon: z.number(),
  }).optional(),
});

export async function GET(request: Request) {
  try {
    // Require admin authentication for viewing driver data (includes CPR)
    const admin = await requireAdmin();

    const drivers = await prisma.comDriver.findMany({
      include: {
        company: {
          select: {
            comName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' }
    });

    // Decrypt CPR for display and log access
    const driversWithDecryptedCPR = await Promise.all(
      drivers.map(async (driver) => {
        try {
          const decryptedCPR = decryptCPR(driver.cpr);

          // Audit log CPR access
          await AuditLogger.log({
            event: AuditEvent.CPR_VIEWED,
            userId: admin.id.toString(),
            ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
                      request.headers.get('cf-connecting-ip') || 'unknown',
            userAgent: request.headers.get('user-agent') || undefined,
            metadata: {
              driverId: driver.id,
              action: 'bulk_view',
              accessLevel: 'full'
            },
            severity: 'high'
          });

          return { ...driver, cpr: decryptedCPR };
        } catch (error) {
          console.error(`Failed to decrypt CPR for driver ${driver.id}:`, error);
          // Return masked CPR if decryption fails
          return { ...driver, cpr: 'DECRYPTION_ERROR' };
        }
      })
    );

    return NextResponse.json({ ok: true, data: driversWithDecryptedCPR });
  } catch (e: any) {
    // If authentication fails, return appropriate error
    if (e.status === 401 || e.status === 403) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: e.status });
    }
    return NextResponse.json({ ok: false, error: e?.message || 'Failed to fetch drivers' }, { status: 500 });
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

    // Check unique username
    const existingUsername = await prisma.comDriver.findUnique({ where: { drUsername: data.drUsername } });
    if (existingUsername) {
      return NextResponse.json({ ok: false, error: 'Username already exists' }, { status: 409 });
    }

    const hashedPassword = await hashPassword(data.drPass);

    // Encrypt CPR before storing
    const encryptedCPR = encryptCPR(data.cpr);

    const apiKey = randomUUID();

    const driver = await prisma.comDriver.create({
      data: {
        comId: data.comId,
        cpr: encryptedCPR,
        drFname: data.drFname,
        drLname: data.drLname,
        sex: data.sex,
        drAddress: data.drAddress,
        drPhone: data.drPhone,
        drEmail: data.drEmail,
        drPhoto: data.drPhoto,
        licenceNr: data.licenceNr,
        drCard: data.drCard,
        rating: data.rating,
        isOnline: data.isOnline,
        isActive: data.isActive,
        car: data.car,
        currentRideId: data.currentRideId,
        drUsername: data.drUsername,
        drPass: hashedPassword,
        apiKey: apiKey,
        lastLocation: data.lastLocation ? JSON.stringify(data.lastLocation) : undefined,
      }
    });

    // Audit log CPR creation
    await AuditLogger.log({
      event: AuditEvent.CPR_CREATED,
      userId: 'system', // Since this is from admin action, we might need to get admin ID
      ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
                req.headers.get('cf-connecting-ip') || 'unknown',
      userAgent: req.headers.get('user-agent') || undefined,
      metadata: {
        driverId: driver.id,
        companyId: data.comId
      },
      severity: 'high'
    });

    // Return driver data with decrypted CPR and API key for immediate display
    const driverWithDecryptedCPR = { ...driver, cpr: data.cpr, apiKey: apiKey };

    return NextResponse.json({ ok: true, data: driverWithDecryptedCPR }, { status: 201 });
  } catch (e: any) {
    console.error('Failed to create driver:', e?.stack || e?.message || e);
    return NextResponse.json({ ok: false, error: e?.message || 'Failed to create driver' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  // This would be handled by [id]/route.ts
  return NextResponse.json({ ok: false, error: 'Use /api/com-drivers/[id] for updates' }, { status: 400 });
}

export async function DELETE(req: Request) {
  // This would be handled by [id]/route.ts
  return NextResponse.json({ ok: false, error: 'Use /api/com-drivers/[id] for deletions' }, { status: 400 });
}