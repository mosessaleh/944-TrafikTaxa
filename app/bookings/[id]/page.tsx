import { redirect } from 'next/navigation';

interface Props {
  params: { id: string };
  searchParams: { [key: string]: string | string[] | undefined };
}

export default function BookingDetailPage({ params, searchParams }: Props) {
  const { id } = params;
  const payment = searchParams.payment;

  // If payment=invoice, redirect to account page with history tab
  if (payment === 'invoice') {
    redirect('/account?tab=history');
  }

  // Default redirect to account page
  redirect('/account?tab=history');
}