import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/db';

export const metadata: Metadata = {
  title: 'FAQ - Frequently Asked Questions | 944 Trafik',
  description: 'Find answers to common questions about booking rides, payments, cancellations, and using 944 Trafik services.',
};

export default async function FAQPage() {
  const settings = await prisma.settings.findFirst();
  return (
    <div className="min-h-screen pt-20 pb-8">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8">
          <div className="flex items-center gap-4 mb-8">
            <Link
              href="/knowledge-base"
              className="text-slate-600 hover:text-slate-800 flex items-center gap-2"
            >
              ← Back to Knowledge Base
            </Link>
          </div>

          <h1 className="text-3xl font-bold text-slate-800 mb-8">Frequently Asked Questions</h1>

          <div className="prose prose-slate max-w-none">
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-slate-800 mb-6">Getting Started</h2>

              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-slate-800 mb-2">How do I create an account?</h3>
                  <p className="text-slate-600">
                    Click "Create account" in the top right corner, fill in your details including name, email, phone number, and address. You'll need to verify your email before you can book rides.
                  </p>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-slate-800 mb-2">Do I need an account to book a ride?</h3>
                  <p className="text-slate-600">
                    Yes, you need a verified account to book rides with 944 Trafik. This helps us provide better service and maintain safety standards.
                  </p>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-slate-800 mb-2">Is the service available 24/7?</h3>
                  <p className="text-slate-600">
                    Our booking system is available 24/7, but actual ride availability depends on driver availability and local regulations. We recommend booking in advance for better availability.
                  </p>
                </div>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-slate-800 mb-6">Booking & Payments</h2>

              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-slate-800 mb-2">How do I book a ride?</h3>
                  <p className="text-slate-600 mb-2">
                    1. Log in to your account
                  </p>
                  <p className="text-slate-600 mb-2">
                    2. Click "Book ride" or go to /book
                  </p>
                  <p className="text-slate-600 mb-2">
                    3. Enter your pickup and dropoff locations
                  </p>
                  <p className="text-slate-600 mb-2">
                    4. Select date, time, and vehicle type
                  </p>
                  <p className="text-slate-600 mb-2">
                    5. Choose payment method and confirm
                  </p>
                  <p className="text-slate-600">
                    For detailed instructions, see our <Link href="/guide" className="text-blue-600 hover:underline">User Guide</Link>.
                  </p>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-slate-800 mb-2">What payment methods do you accept?</h3>
                  <p className="text-slate-600">
                    We accept credit/debit cards, PayPal, Revolut, cryptocurrency (BTC, ETH, USDC, USDT, Pi Network), and invoice payment for eligible business customers. Payment methods may vary by country.
                  </p>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-slate-800 mb-2">Can I pay by invoice?</h3>
                  <p className="text-slate-600">
                    Invoice payment is available for verified business customers and trusted private customers. Contact us to apply for invoice payment privileges.
                  </p>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-slate-800 mb-2">How is the price calculated?</h3>
                  <p className="text-slate-600">
                    Prices are calculated based on distance, time, vehicle type, and any additional services. The price shown is an estimate and may be adjusted for route changes, waiting time, or extra stops.
                  </p>
                </div>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-slate-800 mb-6">Cancellations & Changes</h2>

              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-slate-800 mb-2">What are the cancellation policies?</h3>
                  <div className="bg-slate-50 p-4 rounded-lg mb-4">
                    <h4 className="font-semibold text-slate-800 mb-2">Scheduled rides:</h4>
                    <ul className="text-slate-600 space-y-1 mb-4">
                      <li>• More than 2 hours before: {settings?.scheduledCancellationFee1 || 0}% cancellation fee</li>
                      <li>• 1-2 hours before: Up to {settings?.scheduledCancellationFee2 || 25}% cancellation fee</li>
                      <li>• Less than 1 hour before: Up to {settings?.scheduledCancellationFee3 || 50}% cancellation fee</li>
                      <li>• After pickup time: Full charge as no-show</li>
                    </ul>
                    <h4 className="font-semibold text-slate-800 mb-2">Immediate rides:</h4>
                    <ul className="text-slate-600 space-y-1">
                      <li>• After driver dispatched: Fixed cancellation fee of {settings?.immediateCancellationFee || 50} DKK may apply</li>
                    </ul>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-slate-800 mb-2">Can I change my booking?</h3>
                  <p className="text-slate-600">
                    You can modify your booking details up to 2 hours before pickup time. For significant changes, it may be treated as a cancellation and new booking. Contact us for assistance with changes.
                  </p>
                </div>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-slate-800 mb-6">Safety & Service</h2>

              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-slate-800 mb-2">How do you ensure driver safety and quality?</h3>
                  <p className="text-slate-600">
                    All drivers undergo background checks, vehicle inspections, and training. We maintain strict safety standards and monitor service quality through customer feedback and ratings.
                  </p>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-slate-800 mb-2">What should I do if I have a complaint about a ride?</h3>
                  <p className="text-slate-600">
                    Contact us immediately through the contact form or by phone. We take all complaints seriously and will investigate promptly. You can also leave feedback in your ride history.
                  </p>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-slate-800 mb-2">Are rides tracked in real-time?</h3>
                  <p className="text-slate-600">
                    Yes, you can track your ride in real-time through our app and website. You'll receive updates on driver location, estimated arrival time, and any delays.
                  </p>
                </div>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-slate-800 mb-6">Technical Support</h2>

              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-slate-800 mb-2">I'm having trouble with the website/app</h3>
                  <p className="text-slate-600">
                    Try refreshing the page, clearing your browser cache, or using a different browser. If the problem persists, contact our support team with details about your device and browser.
                  </p>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-slate-800 mb-2">How do I reset my password?</h3>
                  <p className="text-slate-600">
                    Click "Forgot password" on the login page, enter your email address, and follow the instructions sent to your email.
                  </p>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-slate-800 mb-2">Can I book rides for others?</h3>
                  <p className="text-slate-600">
                    Yes, you can book rides for other people using your account. Just enter their pickup/dropoff details and contact information during booking.
                  </p>
                </div>
              </div>
            </section>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-200">
            <p className="text-sm text-slate-500 mb-4">
              Can't find the answer you're looking for?
            </p>
            <Link
              href="/contact"
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Contact Support
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}