import type { Metadata } from 'next';
import { prisma } from '@/lib/db';

export const metadata: Metadata = {
  title: 'Service Rules & Terms | 944 Trafik',
  description: 'Rules for registration, bookings, cancellations, driver conduct and invoice payment at 944 Trafik.',
};

export default async function TermsPage() {
  const paymentMethods = await prisma.paymentMethod.findMany({
    where: { isActive: true },
    orderBy: { id: 'asc' },
  });

  return (
    <div className="min-h-screen pt-20 pb-8">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8">
          <h1 className="text-3xl font-bold text-slate-800 mb-8">Service Rules & Terms</h1>

          <div className="prose prose-slate max-w-none">
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-slate-800 mb-4">1. Registration & Account Rules</h2>
              <p className="text-slate-600 mb-4">
                By creating an account on 944 Trafik you confirm that you agree to these rules, that you are at least
                15 years old, and that you take full responsibility for the information you provide.
              </p>
              <ul className="text-slate-600 mb-4 space-y-2">
                <li>• You must be at least 15 years old to create an account.</li>
                <li>• If you are under 18, you are responsible for ensuring that you have any necessary consent from a parent or guardian.</li>
                <li>• You are fully responsible for the accuracy and truthfulness of all registration information (name, phone number, email, billing details, company details, etc.).</li>
                <li>• You are responsible for keeping your login credentials secure and not sharing them with others.</li>
                <li>• You are responsible for all bookings and actions made from your account.</li>
                <li>• We may temporarily block or close accounts in case of suspected fraud, misuse or unpaid invoices.</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-slate-800 mb-4">2. Booking Rules</h2>
              <p className="text-slate-600 mb-4">
                Bookings can be made as immediate rides or scheduled rides. When you confirm a booking you enter into
                an agreement for transport between you and 944 Trafik / the assigned driver.
              </p>
              <ul className="text-slate-600 mb-4 space-y-2">
                <li>• Pickup and dropoff addresses must be entered correctly and clearly (street, number, city and any notes).</li>
                <li>• The number of passengers and luggage must match the selected vehicle capacity.</li>
                <li>• The price shown in the booking flow is an estimate based on distance, time and vehicle type.</li>
                <li>• In case of major changes (route changes, extra stops, waiting time) the final price may be adjusted.</li>
                <li>• For scheduled rides you must select a realistic pickup time that allows you to reach your destination safely.</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-slate-800 mb-4">3. Cancellation & Changes</h2>
              <p className="text-slate-600 mb-4">
                We understand that plans can change. To protect both customers and drivers, the following rules apply
                to cancellations and changes:
              </p>
              <div className="bg-slate-50 p-4 rounded-lg mb-4">
                <h3 className="font-semibold text-slate-800 mb-2">Scheduled rides</h3>
                <ul className="text-slate-600 space-y-1 mb-4">
                  <li><strong>More than 2 hours before pickup:</strong> No cancellation fee (100% refund of prepaid amount).</li>
                  <li><strong>1–2 hours before pickup:</strong> Up to 25% cancellation fee may be charged.</li>
                  <li><strong>Less than 1 hour before pickup:</strong> Up to 50% of the fare may be charged.</li>
                  <li><strong>After the pickup time / driver arrived:</strong> The ride may be charged in full as a no‑show.</li>
                </ul>
                <h3 className="font-semibold text-slate-800 mb-2">Immediate rides</h3>
                <ul className="text-slate-600 space-y-1">
                  <li><strong>After driver has been dispatched:</strong> A fixed cancellation fee may be charged to cover driver time and distance.</li>
                </ul>
              </div>
              <p className="text-slate-600 mb-4">
                Any refund will normally be processed back to the original payment method within 3–5 business days.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-slate-800 mb-4">4. Passenger Behaviour & Driver Interaction</h2>
              <p className="text-slate-600 mb-4">
                For everyone's safety and comfort, both passenger and driver must behave respectfully and follow local laws.
              </p>
              <ul className="text-slate-600 mb-4 space-y-2">
                <li>• The passenger may choose the route. The driver can advise on safer or faster alternatives, but the final choice of route belongs to the passenger.</li>
                <li>• If the passenger chooses a longer or congested route, any additional time, distance and resulting price are the passenger's responsibility.</li>
                <li>• Passengers must wear seat belts at all times and follow the driver's safety instructions regarding traffic safety and legal requirements.</li>
                <li>• Aggressive, threatening, discriminatory or harassing behaviour is strictly prohibited.</li>
                <li>• Smoking, consuming alcohol or illegal substances in the vehicle is not allowed.</li>
                <li>• Any damage, extreme dirt or cleaning required due to the passenger may be charged as an additional fee.</li>
                <li>• If the driver feels unsafe, they may end the trip and report the incident to 944 Trafik and/or the authorities.</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-slate-800 mb-4">5. Invoice Payment (Pay by Invoice)</h2>
              <p className="text-slate-600 mb-4">
                For selected customers we offer the option to pay rides by invoice instead of paying immediately. This
                feature is a privilege and not a right, and 944 Trafik may grant or remove access at any time.
              </p>
              <h3 className="font-semibold text-slate-800 mb-2">Eligibility rules</h3>
              <ul className="text-slate-600 mb-4 space-y-2">
                <li>• The customer must have a verified account with correct name, company details (if applicable), email and phone number.</li>
                <li>• The customer must have a positive payment history with 944 Trafik and no unpaid or repeatedly late invoices.</li>
                <li>• Invoice payment is typically reserved for business customers, institutions or trusted private customers.</li>
                <li>• A credit check or internal risk assessment may be carried out before enabling invoice payment.</li>
                <li>• The customer must complete identity verification when requested, by sending appropriate documents (for example ID, company registration, address verification).</li>
                <li>• A maximum credit limit per customer may be applied. If the limit is reached, new rides must be prepaid.</li>
              </ul>
              <h3 className="font-semibold text-slate-800 mb-2">Invoice terms</h3>
              <ul className="text-slate-600 mb-4 space-y-2">
                <li>• Standard payment terms are stated on the invoice (for example 8 or 14 days net).</li>
                <li>• In case of late payment, reminder fees and default interest may be added according to Danish law.</li>
                <li>• Repeated late payment or non‑payment may lead to removal of the invoice feature and possible account suspension.</li>
                <li>• If the customer is found to have violated 944 Trafik company rules (for example fraud, misuse or serious complaints), the invoice payment privilege may be cancelled permanently.</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-slate-800 mb-4">6. Misuse, Fraud & Suspension</h2>
              <p className="text-slate-600 mb-4">
                944 Trafik reserves the right to investigate and take action in case of suspected misuse or fraud.
              </p>
              <ul className="text-slate-600 mb-4 space-y-2">
                <li>• Creating multiple accounts to abuse promotions, discounts or credit terms is not allowed.</li>
                <li>• Using false identities, stolen payment methods or fake addresses is strictly prohibited.</li>
                <li>• We may cancel bookings, block invoice access or suspend accounts if we suspect abuse.</li>
                <li>• Serious cases may be reported to the police and relevant authorities.</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-slate-800 mb-4">7. Privacy & Data</h2>
              <p className="text-slate-600 mb-4">
                We process personal data in accordance with applicable privacy legislation (including GDPR).
              </p>
              <ul className="text-slate-600 mb-4 space-y-2">
                <li>• We only collect the data needed to handle your account, bookings and payments.</li>
                <li>• Location data is used for routing, safety and service quality, and is not shared with unauthorised third parties.</li>
                <li>• Payment information is processed securely by trusted payment providers.</li>
              </ul>
              <p className="text-slate-600">
                More detailed information about data processing can be provided on request or in a separate privacy notice.
              </p>
            </section>

            {paymentMethods.length > 0 && (
              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-slate-800 mb-4">8. Payment Methods</h2>
                <p className="text-slate-600 mb-4">
                  The following payment methods are currently active and available in our system. Availability may
                  depend on your country, currency and technical status of each provider.
                </p>
                <ul className="text-slate-600 mb-4 space-y-2">
                  {paymentMethods.map((method) => (
                    <li key={method.id}>
                      • <span className="font-medium">{method.title}</span>{' '}
                      <span className="text-xs text-slate-500">({method.key})</span>
                      {method.description && (
                        <span className="text-slate-600"> – {method.description}</span>
                      )}
                    </li>
                  ))}
                </ul>
                <p className="text-slate-600 text-sm">
                  944 Trafik may activate or deactivate payment methods over time. The methods shown here reflect the
                  options that are currently active in our backend system.
                </p>
              </section>
            )}
          </div>

          <div className="mt-8 pt-6 border-t border-slate-200">
            <p className="text-sm text-slate-500">
              Last updated: {new Date().toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}