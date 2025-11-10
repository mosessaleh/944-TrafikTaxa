import { prisma } from '@/lib/db';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Contact Us | 944 Trafik',
  description: 'Get in touch with 944 Trafik for taxi services in Frederikssund. Contact us for bookings, questions, or support.',
  openGraph: {
    title: 'Contact Us | 944 Trafik',
    description: 'Get in touch with 944 Trafik for taxi services in Frederikssund.',
    images: [{ url: '/logo.svg' }],
  },
};

async function getSettings() {
  const settings = await prisma.settings.findFirst();
  return settings;
}

export default async function ContactPage() {
  const settings = await getSettings();

  if (!settings) {
    return <div>Settings not found</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-cyan-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-cyan-600 to-blue-600 bg-clip-text text-transparent">
            📞 Contact Us
          </h1>
          <p className="text-gray-600 mt-4 text-lg">Get in touch with 944 Trafik</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Contact Information */}
          <div className="bg-white rounded-3xl p-8 shadow-xl">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">📋 Contact Information</h2>
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl flex items-center justify-center text-white text-xl">
                  📧
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800">Email</h3>
                  <a
                    href={`mailto:${settings.contactEmail}`}
                    className="text-cyan-600 hover:text-cyan-700 transition-colors"
                  >
                    {settings.contactEmail}
                  </a>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-500 rounded-2xl flex items-center justify-center text-white text-xl">
                  📞
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800">Phone</h3>
                  <a
                    href={`tel:${settings.contactPhone}`}
                    className="text-cyan-600 hover:text-cyan-700 transition-colors"
                  >
                    {settings.contactPhone}
                  </a>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-indigo-500 rounded-2xl flex items-center justify-center text-white text-xl">
                  📍
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800">Location</h3>
                  <p className="text-gray-600">{settings.addressCity}, Denmark</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl flex items-center justify-center text-white text-xl">
                  🏢
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800">Company</h3>
                  <p className="text-gray-600">{settings.brandName}</p>
                </div>
              </div>
            </div>

            <div className="mt-8 p-4 bg-gradient-to-r from-cyan-50 to-blue-50 rounded-2xl">
              <h3 className="font-semibold text-gray-800 mb-2">🕐 Business Hours</h3>
              <p className="text-sm text-gray-600">
                Monday - Sunday: {settings.workStart} - {settings.workEnd}
              </p>
            </div>
          </div>

          {/* Map Section */}
          <div className="bg-white rounded-3xl p-8 shadow-xl">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">🗺️ Our Location</h2>
            <div className="aspect-square rounded-2xl overflow-hidden">
              <iframe
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2269.0!2d12.0689!3d55.8331!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x46525b8c8c8c8c8c%3A0x0!2zNTXCsDQ5JzU5LjIiTiAxMsKwMDQnMDguMCJF!5e0!3m2!1sen!2sdk!4v1635000000000!5m2!1sen!2sdk"
                width="100%"
                height="100%"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="944 Trafik Location"
              ></iframe>
            </div>
            <p className="text-sm text-gray-600 mt-4 text-center">
              Frederikssund, Denmark
            </p>
          </div>
        </div>

        {/* Additional Info */}
        <div className="mt-8 bg-white rounded-3xl p-8 shadow-xl">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">💡 How to Reach Us</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold text-gray-800 mb-2">🚀 For Bookings</h3>
              <p className="text-gray-600 text-sm">
                Use our online booking system or call us directly for immediate reservations.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-800 mb-2">❓ For Questions</h3>
              <p className="text-gray-600 text-sm">
                Send us an email or give us a call. We're here to help with any inquiries.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}