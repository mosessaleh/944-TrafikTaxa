import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms & Conditions | 944 Trafik',
  description: 'Terms and conditions for using 944 Trafik taxi services.',
};

export default function TermsPage() {
  return (
    <div className="min-h-screen pt-20 pb-8">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8">
          <h1 className="text-3xl font-bold text-slate-800 mb-8">Terms & Conditions</h1>

          <div className="prose prose-slate max-w-none">
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-slate-800 mb-4">1. General Terms</h2>
              <p className="text-slate-600 mb-4">
                Welcome to 944 Trafik. By using our taxi booking services, you agree to these terms and conditions.
                Please read them carefully before booking a ride.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-slate-800 mb-4">2. Booking and Payment</h2>
              <ul className="text-slate-600 mb-4 space-y-2">
                <li>• All bookings must be made through our official website or app</li>
                <li>• Payment is required at the time of booking for all rides</li>
                <li>• We accept various payment methods including credit cards, PayPal, and cryptocurrency</li>
                <li>• Prices are calculated based on distance, duration, and vehicle type</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-slate-800 mb-4">3. Cancellation Policy</h2>
              <p className="text-slate-600 mb-4">
                We understand that plans can change. Our cancellation policy is designed to be fair to both customers and drivers:
              </p>
              <div className="bg-slate-50 p-4 rounded-lg mb-4">
                <h3 className="font-semibold text-slate-800 mb-2">Cancellation Fees:</h3>
                <h4 className="font-medium text-slate-700 mb-2">Scheduled Bookings:</h4>
                <ul className="text-slate-600 space-y-1 mb-4">
                  <li><strong>More than 2 hours before pickup:</strong> No cancellation fee (100% refund)</li>
                  <li><strong>1-2 hours before pickup:</strong> 25% cancellation fee</li>
                  <li><strong>Less than 1 hour before pickup:</strong> 50% cancellation fee</li>
                  <li><strong>After pickup time:</strong> No cancellation allowed</li>
                </ul>
                <h4 className="font-medium text-slate-700 mb-2">Immediate Bookings:</h4>
                <ul className="text-slate-600 space-y-1">
                  <li><strong>Any time before completion:</strong> 100 DKK fixed cancellation fee</li>
                </ul>
              </div>
              <p className="text-slate-600">
                Refunds will be processed within 3-5 business days to the original payment method.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-slate-800 mb-4">4. Service Availability</h2>
              <ul className="text-slate-600 mb-4 space-y-2">
                <li>• Service is available 24/7, subject to driver availability</li>
                <li>• We reserve the right to decline service in certain circumstances</li>
                <li>• Wait times may vary based on demand and location</li>
                <li>• We are not responsible for delays caused by traffic or other external factors</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-slate-800 mb-4">5. Passenger Responsibilities</h2>
              <ul className="text-slate-600 mb-4 space-y-2">
                <li>• Passengers must provide accurate pickup and dropoff locations</li>
                <li>• Passengers must be ready at the pickup location at the scheduled time</li>
                <li>• Maximum wait time at pickup is 3 minutes for immediate bookings</li>
                <li>• Passengers are responsible for their belongings during the ride</li>
                <li>• No smoking, eating, or drinking alcohol in vehicles</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-slate-800 mb-4">6. Driver and Vehicle Standards</h2>
              <ul className="text-slate-600 mb-4 space-y-2">
                <li>• All drivers are licensed and insured</li>
                <li>• Vehicles are regularly maintained and meet safety standards</li>
                <li>• GPS tracking is available for all rides</li>
                <li>• Emergency contact information is provided for all bookings</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-slate-800 mb-4">7. Liability and Insurance</h2>
              <ul className="text-slate-600 mb-4 space-y-2">
                <li>• We maintain comprehensive insurance coverage</li>
                <li>• Passengers travel at their own risk</li>
                <li>• We are not liable for personal belongings left in vehicles</li>
                <li>• Maximum liability is limited to the fare amount</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-slate-800 mb-4">8. Privacy and Data Protection</h2>
              <ul className="text-slate-600 mb-4 space-y-2">
                <li>• We collect personal information necessary for service provision</li>
                <li>• Data is protected in accordance with GDPR and Danish privacy laws</li>
                <li>• Location data is used only for ride coordination</li>
                <li>• Payment information is securely processed and not stored</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-slate-800 mb-4">9. Contact Information</h2>
              <p className="text-slate-600 mb-4">
                For questions or concerns about our services:
              </p>
              <ul className="text-slate-600 space-y-1">
                <li><strong>Phone:</strong> +45 26 44 94 44</li>
                <li><strong>Email:</strong> trafik@944.dk</li>
                <li><strong>Address:</strong> Frederikssund, Denmark</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-slate-800 mb-4">10. Changes to Terms</h2>
              <p className="text-slate-600">
                We reserve the right to modify these terms and conditions at any time.
                Changes will be effective immediately upon posting on our website.
                Continued use of our services constitutes acceptance of the updated terms.
              </p>
            </section>
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