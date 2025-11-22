import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Knowledge Base | 944 Trafik',
  description: 'Find answers to common questions and learn how to use 944 Trafik services.',
};

export default function KnowledgeBasePage() {
  return (
    <div className="min-h-screen pt-20 pb-8">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8">
          <h1 className="text-3xl font-bold text-slate-800 mb-8">Knowledge Base</h1>

          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <Link
              href="/faq"
              className="block p-6 bg-slate-50 rounded-lg border border-slate-200 hover:bg-slate-100 hover:border-slate-300 transition-colors"
            >
              <h2 className="text-xl font-semibold text-slate-800 mb-3">Frequently Asked Questions</h2>
              <p className="text-slate-600">
                Find quick answers to the most common questions about booking rides, payments, cancellations, and more.
              </p>
            </Link>

            <Link
              href="/guide"
              className="block p-6 bg-slate-50 rounded-lg border border-slate-200 hover:bg-slate-100 hover:border-slate-300 transition-colors"
            >
              <h2 className="text-xl font-semibold text-slate-800 mb-3">User Guide</h2>
              <p className="text-slate-600">
                Step-by-step instructions on how to book rides, manage your account, and make the most of our services.
              </p>
            </Link>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-blue-800 mb-2">Need More Help?</h3>
            <p className="text-blue-700 mb-4">
              Can't find what you're looking for? Our support team is here to help.
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