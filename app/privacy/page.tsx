"use client";

import Link from "next/link";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-4xl bg-white rounded-3xl shadow-2xl p-10 border border-slate-100">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-slate-900 mb-3">Privacy Policy</h1>
          <p className="text-slate-600">
            Your privacy matters. This policy explains how we collect, use, and protect your data.
          </p>
        </div>

        <div className="space-y-6 text-slate-700 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">1. Data We Collect</h2>
            <p>
              We collect account information (name, email, company), usage data, and any files or
              inputs you provide to the platform to deliver estimating and collaboration features.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">2. How We Use Data</h2>
            <p>
              Data is used to provide and improve the service, support users, enhance security, and
              deliver product insights. We do not sell your data.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">3. Sharing</h2>
            <p>
              We may share data with trusted subprocessors (e.g., hosting, analytics) under strict
              data protection terms. We may disclose data if required by law.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">4. Security</h2>
            <p>
              We use industry-standard measures to protect data in transit and at rest. Users are
              responsible for maintaining secure access to their accounts.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">5. Data Retention</h2>
            <p>
              We retain data while your account is active or as needed to provide the service. You
              may request deletion subject to legal and operational constraints.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">6. Your Rights</h2>
            <p>
              You may access, correct, or request deletion of your data, and opt out of certain
              communications. Contact support for privacy requests.
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

