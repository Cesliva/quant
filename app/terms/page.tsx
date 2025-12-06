"use client";

import Link from "next/link";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-4xl bg-white rounded-3xl shadow-2xl p-10 border border-slate-100">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-slate-900 mb-3">Terms of Service</h1>
          <p className="text-slate-600">
            Please read these terms carefully before using Quant Steel Estimating.
          </p>
        </div>

        <div className="space-y-6 text-slate-700 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">1. Acceptance of Terms</h2>
            <p>
              By accessing or using the Quant Steel Estimating platform, you agree to be bound by
              these Terms of Service. If you do not agree, please do not use the service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">2. Use of Service</h2>
            <p>
              You agree to use the service only for lawful purposes and in accordance with these
              terms. You are responsible for maintaining the confidentiality of your account and for
              all activities that occur under your account.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">3. Data & Content</h2>
            <p>
              You retain ownership of your data. By using the service, you grant us a limited license
              to process and store your data for the purpose of delivering the service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">4. Availability</h2>
            <p>
              We strive for high availability but do not guarantee uninterrupted service. We may
              suspend or limit access for maintenance, security, or technical reasons.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">5. Limitation of Liability</h2>
            <p>
              To the fullest extent permitted by law, Quant is not liable for indirect, incidental, or
              consequential damages arising from the use of the service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">6. Changes to Terms</h2>
            <p>
              We may update these terms from time to time. Continued use of the service after changes
              take effect constitutes acceptance of the revised terms.
            </p>
          </section>
        </div>

        <div className="mt-10 flex items-center justify-between">
          <Link
            href="/signup"
            className="text-blue-600 hover:text-blue-700 font-semibold"
          >
            Back to Signup
          </Link>
          <Link
            href="/"
            className="text-slate-600 hover:text-slate-800 font-medium"
          >
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}

