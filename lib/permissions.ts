export const STAFF_ROLES = [
  'ADMIN',
  'SUPER_ADMIN',
  'DISPATCHER',
  'FINANCE',
  'SUPPORT',
  'PARTNER_MANAGER'
] as const;

export type StaffRole = (typeof STAFF_ROLES)[number];
export type AppRole = 'USER' | StaffRole;

export type Permission =
  | 'admin.access'
  | 'admin.full'
  | 'users.read'
  | 'users.manage'
  | 'users.manage_roles'
  | 'bookings.read'
  | 'bookings.manage'
  | 'dispatch.manage'
  | 'drivers.read'
  | 'drivers.manage'
  | 'partners.read'
  | 'partners.manage'
  | 'payments.read'
  | 'payments.manage'
  | 'invoices.read'
  | 'invoices.manage'
  | 'complaints.read'
  | 'complaints.manage'
  | 'risk.read'
  | 'risk.manage'
  | 'settings.read'
  | 'settings.manage'
  | 'crypto.read'
  | 'crypto.manage'
  | 'news.manage'
  | 'audit.read'
  | 'danger.manage';

const ROLE_PERMISSIONS: Record<StaffRole, Permission[]> = {
  ADMIN: ['admin.full'],
  SUPER_ADMIN: ['admin.full'],
  DISPATCHER: [
    'admin.access',
    'bookings.read',
    'bookings.manage',
    'dispatch.manage',
    'drivers.read',
    'drivers.manage'
  ],
  FINANCE: [
    'admin.access',
    'bookings.read',
    'payments.read',
    'payments.manage',
    'invoices.read',
    'invoices.manage',
    'crypto.read',
    'crypto.manage'
  ],
  SUPPORT: [
    'admin.access',
    'users.read',
    'bookings.read',
    'complaints.read',
    'complaints.manage',
    'risk.read'
  ],
  PARTNER_MANAGER: [
    'admin.access',
    'partners.read',
    'partners.manage',
    'drivers.read',
    'drivers.manage',
    'bookings.read'
  ]
};

export function isStaffRole(role: unknown): role is StaffRole {
  return typeof role === 'string' && STAFF_ROLES.includes(role as StaffRole);
}

export function hasPermission(role: unknown, permission: Permission): boolean {
  if (!isStaffRole(role)) return false;

  const permissions = ROLE_PERMISSIONS[role];
  return permissions.includes('admin.full') || permissions.includes(permission);
}

export function hasAnyPermission(role: unknown, permissions: Permission[]): boolean {
  return permissions.some((permission) => hasPermission(role, permission));
}
