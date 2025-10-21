import BookingForm from '@/components/booking-form';
import { getCurrentUser } from '@/lib/session';
import Link from 'next/link';
import Alert from '@/components/alert';

export default async function BookPage(){
  const u = await getCurrentUser();
  if (!u) return <div className="text-center">Unauthorized</div>;
  const verifyUrl = `/verify?email=${encodeURIComponent(u.email)}`;
  if (!u.emailVerified){
    return (
      <div className="max-w-2xl mx-auto grid gap-6">
        <h1 className="text-3xl font-bold">Book a Ride</h1>
        <Alert title="Email verification required" message="Please verify your email to book a ride." action={<Link href={verifyUrl} className="px-4 py-2 rounded-xl border bg-black text-white">Go to verification</Link>} />
      </div>
    );
  }
  return (
    <div className="grid gap-6">
      <h1 className="text-3xl font-bold">Book a Ride</h1>
      <p className="text-gray-600">Instant or scheduled ride — up to 4 passengers per car.</p>
      <BookingForm />
    </div>
  );
}
