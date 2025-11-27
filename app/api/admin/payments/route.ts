import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getUserFromCookie } from '@/lib/auth';

type AdminPaymentType = 'card' | 'crypto' | 'paypal' | 'revolut' | 'invoice';

interface AdminPaymentUser {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
}

interface AdminPaymentItem {
  id: string; // composite ID, e.g. "card:<id>" or "invoice:<id>"
  sourceId: string; // original payment or invoice ID as string
  type: AdminPaymentType;
  methodKey: string;
  amountDkk: number;
  status: string;
  createdAt: string;
  user?: AdminPaymentUser | null;
  invoiceId?: number | null;
  invoiceNumber?: string | null;
  extra?: Record<string, any>;
}

export async function GET(request: NextRequest) {
  try {
    const me = await getUserFromCookie();
    if (!me || me.type !== 'user' || (me as any).role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const methodFilter = url.searchParams.get('method'); // card|crypto|paypal|revolut|invoice
    const statusFilter = url.searchParams.get('status'); // paid|pending|failed...
    const limitParam = url.searchParams.get('limit');
    const limit = Math.min(Math.max(Number(limitParam || '200'), 1), 1000);

    // Fetch raw payment records in parallel
    const [
      cardPayments,
      cryptoPayments,
      paypalPayments,
      revolutPayments,
      invoicePayments,
    ] = await Promise.all([
      prisma.cardPayment.findMany({
        orderBy: { createdAt: 'desc' },
      }) as any,
      prisma.cryptoPayment.findMany({
        orderBy: { createdAt: 'desc' },
      }) as any,
      prisma.payPalPayment.findMany({
        orderBy: { createdAt: 'desc' },
      }) as any,
      prisma.revolutPayment.findMany({
        orderBy: { createdAt: 'desc' },
      }) as any,
      prisma.invoice.findMany({
        where: {
          paymentStatus: 'PAID',
          status: 1,
          // Only invoice-based or admin-confirmed payments
          paymentMethod: {
            in: ['invoice', 'admin_confirmed'],
          },
        },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          ride: {
            select: {
              id: true,
              price: true,
              paymentStatus: true,
              paymentMethod: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }) as any,
    ]);

    // Collect user IDs from payment tables to hydrate user info
    const userIdSet = new Set<number>();

    for (const p of cardPayments) {
      if (p.userId) {
        const idNum = Number(p.userId);
        if (!Number.isNaN(idNum)) userIdSet.add(idNum);
      }
    }
    for (const p of cryptoPayments) {
      if (p.userId) {
        const idNum = Number(p.userId);
        if (!Number.isNaN(idNum)) userIdSet.add(idNum);
      }
    }
    for (const p of paypalPayments) {
      if (p.userId) {
        const idNum = Number(p.userId);
        if (!Number.isNaN(idNum)) userIdSet.add(idNum);
      }
    }
    for (const p of revolutPayments) {
      if (p.userId) {
        const idNum = Number(p.userId);
        if (!Number.isNaN(idNum)) userIdSet.add(idNum);
      }
    }
    for (const inv of invoicePayments) {
      if (inv.userId) {
        userIdSet.add(inv.userId);
      }
    }

    let usersById = new Map<number, AdminPaymentUser>();
    let invoicesByUser = new Map<
      number,
      { id: number; invoiceNumber: string; userId: number; createdAt: Date }[]
    >();

    if (userIdSet.size > 0) {
      const userIds = Array.from(userIdSet);
      const users = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      });

      usersById = new Map(users.map((u) => [u.id, u]));

      // Fetch invoices for those users to best-effort link payments to invoices
      const invoicesForUsers = await prisma.invoice.findMany({
        where: {
          userId: { in: userIds },
          status: 1,
          paymentStatus: 'PAID',
        },
        select: {
          id: true,
          invoiceNumber: true,
          userId: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      for (const inv of invoicesForUsers) {
        const arr = invoicesByUser.get(inv.userId) || [];
        arr.push(inv);
        invoicesByUser.set(inv.userId, arr);
      }
    }

    const items: AdminPaymentItem[] = [];

    const pushItem = (item: AdminPaymentItem) => {
      if (methodFilter && item.methodKey !== methodFilter) return;
      if (statusFilter && item.status.toLowerCase() !== statusFilter.toLowerCase()) return;
      items.push(item);
    };

    // Card payments
    for (const p of cardPayments) {
      const userIdNum = p.userId ? Number(p.userId) : NaN;
      const user = !Number.isNaN(userIdNum) ? usersById.get(userIdNum) || null : null;
      const userInvoices = !Number.isNaN(userIdNum)
        ? invoicesByUser.get(userIdNum) || []
        : [];
      const inv = userInvoices[0];

      pushItem({
        id: `card:${p.id}`,
        sourceId: String(p.id),
        type: 'card',
        methodKey: 'card',
        amountDkk: Number(p.amountDkk || 0),
        status: String(p.status || 'paid'),
        createdAt: (p.createdAt instanceof Date ? p.createdAt : new Date(p.createdAt)).toISOString(),
        user,
        invoiceId: inv?.id ?? null,
        invoiceNumber: inv?.invoiceNumber ?? null,
        extra: {
          provider: 'Card',
        },
      });
    }

    // Crypto payments
    for (const p of cryptoPayments) {
      const userIdNum = p.userId ? Number(p.userId) : NaN;
      const user = !Number.isNaN(userIdNum) ? usersById.get(userIdNum) || null : null;
      const userInvoices = !Number.isNaN(userIdNum)
        ? invoicesByUser.get(userIdNum) || []
        : [];
      const inv = userInvoices[0];

      pushItem({
        id: `crypto:${p.id}`,
        sourceId: String(p.id),
        type: 'crypto',
        methodKey: 'crypto',
        amountDkk: Number(p.amountDkk || 0),
        status: String(p.status || 'confirmed'),
        createdAt: (p.createdAt instanceof Date ? p.createdAt : new Date(p.createdAt)).toISOString(),
        user,
        invoiceId: inv?.id ?? null,
        invoiceNumber: inv?.invoiceNumber ?? null,
        extra: {
          provider: 'Crypto',
          symbol: p.symbol,
          network: p.network,
          address: p.address,
          amountCoin: p.amountCoin,
        },
      });
    }

    // PayPal payments
    for (const p of paypalPayments) {
      const userIdNum = p.userId ? Number(p.userId) : NaN;
      const user = !Number.isNaN(userIdNum) ? usersById.get(userIdNum) || null : null;
      const userInvoices = !Number.isNaN(userIdNum)
        ? invoicesByUser.get(userIdNum) || []
        : [];
      const inv = userInvoices[0];

      pushItem({
        id: `paypal:${p.id}`,
        sourceId: String(p.id),
        type: 'paypal',
        methodKey: 'paypal',
        amountDkk: Number(p.amountDkk || 0),
        status: String(p.status || 'paid'),
        createdAt: (p.createdAt instanceof Date ? p.createdAt : new Date(p.createdAt)).toISOString(),
        user,
        invoiceId: inv?.id ?? null,
        invoiceNumber: inv?.invoiceNumber ?? null,
        extra: {
          provider: 'PayPal',
          paypalOrderId: p.paypalOrderId,
        },
      });
    }

    // Revolut payments
    for (const p of revolutPayments) {
      const userIdNum = p.userId ? Number(p.userId) : NaN;
      const user = !Number.isNaN(userIdNum) ? usersById.get(userIdNum) || null : null;
      const userInvoices = !Number.isNaN(userIdNum)
        ? invoicesByUser.get(userIdNum) || []
        : [];
      const inv = userInvoices[0];

      pushItem({
        id: `revolut:${p.id}`,
        sourceId: String(p.id),
        type: 'revolut',
        methodKey: 'revolut',
        amountDkk: Number(p.amountDkk || 0),
        status: String(p.status || 'paid'),
        createdAt: (p.createdAt instanceof Date ? p.createdAt : new Date(p.createdAt)).toISOString(),
        user,
        invoiceId: inv?.id ?? null,
        invoiceNumber: inv?.invoiceNumber ?? null,
        extra: {
          provider: 'Revolut',
          paymentId: p.paymentId,
        },
      });
    }

    // Invoice-based payments (invoice/admin_confirmed)
    for (const inv of invoicePayments) {
      const user = inv.user
        ? {
            id: inv.user.id,
            firstName: inv.user.firstName,
            lastName: inv.user.lastName,
            email: inv.user.email,
          }
        : null;

      const amount =
        typeof inv.paymentAmount === 'number' && inv.paymentAmount > 0
          ? inv.paymentAmount
          : inv.ride?.price || 0;

      pushItem({
        id: `invoice:${inv.id}`,
        sourceId: String(inv.id),
        type: 'invoice',
        methodKey: inv.paymentMethod || 'invoice',
        amountDkk: Number(amount || 0),
        status: String(inv.paymentStatus || 'PAID'),
        createdAt: (inv.paymentDate instanceof Date
          ? inv.paymentDate
          : inv.createdAt instanceof Date
          ? inv.createdAt
          : new Date(inv.createdAt)
        ).toISOString(),
        user,
        invoiceId: inv.id,
        invoiceNumber: inv.invoiceNumber,
        extra: {
          provider: inv.paymentMethod || 'invoice',
          paymentRef: inv.paymentRef,
          receiptNumber: inv.receiptNumber,
          rideId: inv.ride?.id,
        },
      });
    }

    // Sort all items by createdAt desc
    items.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    const sliced = items.slice(0, limit);

    return NextResponse.json({
      ok: true,
      count: sliced.length,
      payments: sliced,
    });
  } catch (error) {
    console.error('Error fetching admin payments:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}