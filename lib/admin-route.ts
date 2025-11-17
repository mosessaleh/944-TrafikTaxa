const slug = process.env.NEXT_PUBLIC_ADMIN_ROUTE_SLUG?.trim();

export const ADMIN_BASE_PATH =
  slug && slug !== ''
    ? (slug.startsWith('/') ? slug : `/${slug}`)
    : '/admin';

export function getAdminPath(path: string = ''): string {
  if (!path) return ADMIN_BASE_PATH;
  return path.startsWith('/')
    ? `${ADMIN_BASE_PATH}${path}`
    : `${ADMIN_BASE_PATH}/${path}`;
}