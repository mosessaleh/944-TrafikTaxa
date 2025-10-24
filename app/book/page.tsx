import BookingPayTrigger from "@/app/_components/BookingPayTrigger";
import { confirmBookingAndGoToPay } from "@/app/_actions/booking-pay";
import { getCurrentUser } from '@/lib/session';
import BookClient from '@/components/book-client';

export default async function BookPage(){
  const me = await getCurrentUser();
  return <BookClient me={me}/>;
}
