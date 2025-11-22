import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/db';

export const metadata: Metadata = {
  title: 'User Guide | 944 Trafik',
  description: 'Step-by-step guide on how to book rides, manage your account, and use 944 Trafik services effectively.',
};

export default async function UserGuidePage() {
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

          <h1 className="text-3xl font-bold text-slate-800 mb-8">User Guide</h1>

          <div className="prose prose-slate max-w-none">
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-slate-800 mb-6">Getting Started</h2>

              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-slate-800 mb-3">1. Creating Your Account</h3>
                  <div className="bg-slate-50 p-4 rounded-lg mb-4">
                    <ol className="text-slate-600 space-y-2 list-decimal list-inside">
                      <li>Click "Create account" in the top right corner of the website</li>
                      <li>Fill in your personal information:
                        <ul className="ml-6 mt-2 space-y-1 list-disc">
                          <li>First name and last name</li>
                          <li>Email address (must be valid for verification)</li>
                          <li>Phone number</li>
                          <li>Address for pickup/dropoff purposes</li>
                        </ul>
                      </li>
                      <li>Create a secure password (minimum 8 characters)</li>
                      <li>Accept the terms and conditions</li>
                      <li>Click "Create account"</li>
                      <li>Check your email and click the verification link</li>
                    </ol>
                  </div>
                  <p className="text-slate-600 text-sm">
                    <strong>Note:</strong> You must verify your email before you can book rides.
                  </p>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-slate-800 mb-3">2. Logging In</h3>
                  <div className="bg-slate-50 p-4 rounded-lg">
                    <ol className="text-slate-600 space-y-2 list-decimal list-inside">
                      <li>Click "Log in" in the top right corner</li>
                      <li>Enter your email address and password</li>
                      <li>Click "Log in"</li>
                      <li>If you forgot your password, click "Forgot password" and follow the instructions</li>
                    </ol>
                  </div>
                </div>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-slate-800 mb-6">Booking a Ride</h2>

              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-slate-800 mb-3">Option 1: Immediate Ride</h3>
                  <div className="bg-slate-50 p-4 rounded-lg mb-4">
                    <ol className="text-slate-600 space-y-2 list-decimal list-inside">
                      <li>Log in to your account</li>
                      <li>Click "Book ride" from the navigation menu</li>
                      <li>Select "Immediate ride" (default option)</li>
                      <li>Enter your pickup location:
                        <ul className="ml-6 mt-2 space-y-1 list-disc">
                          <li>Use the address autocomplete or enter manually</li>
                          <li>Be as specific as possible (street, number, city)</li>
                          <li>Add any special instructions (e.g., "Ring doorbell")</li>
                        </ul>
                      </li>
                      <li>Enter your destination</li>
                      <li>Select vehicle type (Standard, Premium, etc.)</li>
                      <li>Review the estimated price and time</li>
                      <li>Select payment method</li>
                      <li>Click "Book ride" to confirm</li>
                    </ol>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-slate-800 mb-3">Option 2: Scheduled Ride</h3>
                  <div className="bg-slate-50 p-4 rounded-lg mb-4">
                    <ol className="text-slate-600 space-y-2 list-decimal list-inside">
                      <li>Follow steps 1-6 from immediate ride booking</li>
                      <li>Select "Scheduled ride" option</li>
                      <li>Choose your preferred date and time</li>
                      <li>Review all details carefully</li>
                      <li>Select payment method (required for scheduled rides)</li>
                      <li>Click "Book ride" to confirm</li>
                    </ol>
                  </div>
                  <p className="text-slate-600 text-sm">
                    <strong>Tip:</strong> Book scheduled rides at least 2 hours in advance to avoid cancellation fees.
                  </p>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-slate-800 mb-3">Payment Methods</h3>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <h4 className="font-semibold text-blue-800 mb-2">Available Methods:</h4>
                      <ul className="text-blue-700 space-y-1 text-sm">
                        <li>• Credit/Debit Cards</li>
                        <li>• PayPal</li>
                        <li>• Revolut</li>
                        <li>• Cryptocurrency (BTC, ETH, USDC, USDT, Pi)</li>
                        <li>• Invoice (for eligible customers)</li>
                      </ul>
                    </div>
                    <div className="bg-green-50 p-4 rounded-lg">
                      <h4 className="font-semibold text-green-800 mb-2">Payment Flow:</h4>
                      <ul className="text-green-700 space-y-1 text-sm">
                        <li>• Select method during booking</li>
                        <li>• Enter payment details securely</li>
                        <li>• Payment processed after ride completion</li>
                        <li>• Receipt sent via email</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-slate-800 mb-6">Managing Your Bookings</h2>

              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-slate-800 mb-3">Viewing Your Ride History</h3>
                  <div className="bg-slate-50 p-4 rounded-lg">
                    <ol className="text-slate-600 space-y-2 list-decimal list-inside">
                      <li>Log in to your account</li>
                      <li>Click on your profile avatar (top right)</li>
                      <li>Select "Profile" from the dropdown</li>
                      <li>Navigate to the "Ride History" tab</li>
                      <li>View past and upcoming rides</li>
                      <li>Click on any ride for detailed information</li>
                    </ol>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-slate-800 mb-3">Tracking Your Ride</h3>
                  <div className="bg-slate-50 p-4 rounded-lg">
                    <p className="text-slate-600 mb-3">Once your ride is confirmed:</p>
                    <ul className="text-slate-600 space-y-2 list-disc list-inside">
                      <li>You'll receive driver details via email/SMS</li>
                      <li>Track the driver in real-time on the website</li>
                      <li>Receive updates on estimated arrival time</li>
                      <li>Contact the driver directly using provided phone number</li>
                      <li>Rate and review the ride after completion</li>
                    </ul>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-slate-800 mb-3">Modifying or Canceling a Booking</h3>
                  <div className="bg-yellow-50 p-4 rounded-lg mb-4">
                    <h4 className="font-semibold text-yellow-800 mb-2">Important Cancellation Policy:</h4>
                    <ul className="text-yellow-700 space-y-1 text-sm mb-4">
                      <li>• More than 2 hours before: {settings?.scheduledCancellationFee1 || 0}% fee</li>
                      <li>• 1-2 hours before: Up to {settings?.scheduledCancellationFee2 || 25}% fee</li>
                      <li>• Less than 1 hour before: Up to {settings?.scheduledCancellationFee3 || 50}% fee</li>
                      <li>• After pickup: Full charge</li>
                    </ul>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-lg">
                    <ol className="text-slate-600 space-y-2 list-decimal list-inside">
                      <li>Go to your ride history or upcoming rides</li>
                      <li>Click on the ride you want to modify</li>
                      <li>Select "Modify" or "Cancel"</li>
                      <li>For modifications, update details and confirm</li>
                      <li>For cancellations, confirm and note any fees</li>
                    </ol>
                  </div>
                </div>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-slate-800 mb-6">Account Management</h2>

              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-slate-800 mb-3">Updating Your Profile</h3>
                  <div className="bg-slate-50 p-4 rounded-lg">
                    <ol className="text-slate-600 space-y-2 list-decimal list-inside">
                      <li>Click on your profile avatar</li>
                      <li>Select "Profile" from the dropdown</li>
                      <li>Navigate to "Profile Settings"</li>
                      <li>Update your personal information</li>
                      <li>Change password if needed</li>
                      <li>Save changes</li>
                    </ol>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-slate-800 mb-3">Managing Payment Methods</h3>
                  <div className="bg-slate-50 p-4 rounded-lg">
                    <ol className="text-slate-600 space-y-2 list-decimal list-inside">
                      <li>Go to Profile → Payment Methods</li>
                      <li>Add new payment methods</li>
                      <li>Set a default payment method</li>
                      <li>Remove old payment methods</li>
                      <li>Update billing information</li>
                    </ol>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-slate-800 mb-3">Invoice Payment Setup</h3>
                  <div className="bg-slate-50 p-4 rounded-lg">
                    <p className="text-slate-600 mb-3">For business customers:</p>
                    <ol className="text-slate-600 space-y-2 list-decimal list-inside">
                      <li>Ensure your account is fully verified</li>
                      <li>Contact support to request invoice payment</li>
                      <li>Provide necessary business documentation</li>
                      <li>Wait for approval (may take 1-2 business days)</li>
                      <li>Once approved, invoice payment becomes available</li>
                    </ol>
                  </div>
                </div>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-slate-800 mb-6">Safety & Best Practices</h2>

              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-slate-800 mb-3">During Your Ride</h3>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <ul className="text-green-700 space-y-2 list-disc list-inside">
                      <li>Always wear your seatbelt</li>
                      <li>Follow the driver's safety instructions</li>
                      <li>Keep the conversation respectful and appropriate</li>
                      <li>No smoking, eating, or drinking alcohol in the vehicle</li>
                      <li>Pay attention to traffic rules and regulations</li>
                      <li>Report any concerns immediately to 944 Trafik support</li>
                    </ul>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-slate-800 mb-3">What to Do in Case of Issues</h3>
                  <div className="bg-red-50 p-4 rounded-lg">
                    <ul className="text-red-700 space-y-2 list-disc list-inside">
                      <li>Contact 944 Trafik support immediately</li>
                      <li>Have your booking reference number ready</li>
                      <li>Take photos if there's vehicle damage</li>
                      <li>Report safety concerns directly</li>
                      <li>Rate your experience after the ride</li>
                      <li>Keep all communication records</li>
                    </ul>
                  </div>
                </div>
              </div>
            </section>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-200">
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
              <p className="text-sm text-slate-500">
                Still need help? Check our <Link href="/faq" className="text-blue-600 hover:underline">FAQ</Link> or contact support.
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
    </div>
  );
}