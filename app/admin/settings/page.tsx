import AdminSettingsClient from '@/components/admin-settings-client';
import { requireAdmin } from '@/lib/auth';

export default async function AdminSettingsPage(){
  await requireAdmin();
  return <AdminSettingsClient/>;
}
