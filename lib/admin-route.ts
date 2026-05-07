const resolveServerAdminBasePath = () => {
  const slug = process.env.ADMIN_ROUTE_SLUG?.trim();
  if (!slug) return '/admin';
  return slug.startsWith('/') ? slug : `/${slug}`;
};

export const ADMIN_BASE_PATH =
  typeof window === 'undefined'
    ? resolveServerAdminBasePath()
    : '/admin-access';

export function getAdminPath(path: string = ''): string {
  const normalizedPath = !path ? '' : path.startsWith('/') ? path : `/${path}`;

  if (typeof window !== 'undefined') {
    return normalizedPath
      ? `${ADMIN_BASE_PATH}?next=${encodeURIComponent(normalizedPath)}`
      : ADMIN_BASE_PATH;
  }

  return normalizedPath ? `${ADMIN_BASE_PATH}${normalizedPath}` : ADMIN_BASE_PATH;
}
