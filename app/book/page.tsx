import { getCurrentUser } from '@/lib/session';
import BookClient from '@/components/book-client';

export default async function BookPage(){
  const me = await getCurrentUser();
  return <BookClient me={me}/>;
}
