import AdminSettingsClient from '@/components/admin-settings-client';
import { requirePermission } from '@/lib/auth';

export default async function AdminSettingsPage(){
  await requirePermission('settings.read');
  return <AdminSettingsClient/>;
}
