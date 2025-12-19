import { PrismaClient } from '@prisma/client';

// Prevent multiple Prisma instances in dev (Next.js HMR)
const globalForPrisma = globalThis as unknown as { prismaV2?: PrismaClient };

export const prisma = globalForPrisma.prismaV2 || new PrismaClient({
  log: []
});

if (process.env.NODE_ENV !== 'production') globalForPrisma.prismaV2 = prisma;
