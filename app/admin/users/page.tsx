import { prisma } from '@/lib/db';
import AdminUsersClient, { AdminUser } from '@/components/AdminUsersClient';

export default async function AdminUsers(){
  const raw = await prisma.user.findMany({
    orderBy:{ id:'desc' },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      address: true,
      role: true,
      emailVerified: true,
      canPayByInvoice: true,
      createdAt: true,
    }
  });

  const users: AdminUser[] = raw.map((u) => ({
    id: u.id,
    firstName: u.firstName,
    lastName: u.lastName,
    email: u.email,
    phone: u.phone,
    address: u.address,
    role: u.role as AdminUser['role'],
    emailVerified: u.emailVerified,
    canPayByInvoice: u.canPayByInvoice ?? false,
    createdAt: u.createdAt ? u.createdAt.toISOString() : null,
  }));

  return (
    <div className="grid gap-4">
      <AdminUsersClient initialUsers={users} />
    </div>
  );
}
