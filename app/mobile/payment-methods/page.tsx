import { getUserFromCookie } from '@/lib/auth';
import PaymentMethodsClient from '@/components/payment-methods-client';

export default async function MobilePaymentMethodsPage() {
  const user = await getUserFromCookie();

  if (!user || user.type !== 'user') {
    return <div>Unauthorized</div>;
  }

  return (
    <main className="min-h-screen bg-stone-50 px-4 py-6">
      <div className="mx-auto max-w-2xl">
        <PaymentMethodsClient />
      </div>
    </main>
  );
}
