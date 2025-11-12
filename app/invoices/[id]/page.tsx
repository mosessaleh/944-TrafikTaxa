import InvoiceClientComponent from './InvoiceClientComponent';

// Main page component
export default function InvoicePage({ params }: { params: { id: string } }) {
  return <InvoiceClientComponent invoiceId={params.id} />;
}