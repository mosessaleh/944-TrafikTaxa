import { redirect } from 'next/navigation';

export default function HistoryPage(){
  // Redirect to account page with history tab
  redirect('/account?tab=history');
}
