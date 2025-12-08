"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/hooks/useAuth";
import { ArrowRight, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { QMark } from "@/components/ui/QMark";
import { QLoader } from "@/components/ui/QLoader";

export default function SignupPage() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    companyName: "",
    betaAccessCode: "",
    licenseSerial: "",
    marketingOptIn: true, // Default to true for marketing
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState("");
  const { signUp, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user) {
      router.push("/");
    }
  }, [user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);

    try {
      // Create user account and company via API
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          name: formData.name,
          companyName: formData.companyName,
          betaAccessCode: formData.betaAccessCode || undefined,
          licenseSerial: formData.licenseSerial || undefined,
          marketingOptIn: formData.marketingOptIn,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create account");
      }

      // If email verification is required, show verification step
      if (data.emailVerificationRequired) {
        setUserId(data.userId);
        setUserEmail(formData.email);
        setNeedsVerification(true);
        setLoading(false);
        
        // In development mode, show the code
        if (data.verificationCode) {
          console.log("Verification code (dev mode):", data.verificationCode);
        }
        return;
      }

      // Sign in the user
      await signUp(formData.email, formData.password);
      
      // Redirect based on license type
      if (data.needsSetup && data.licenseType === "multi-user") {
        // Multi-user license needs setup - redirect to setup page
        router.push("/setup/multi-user");
      } else {
        router.push("/dashboard");
      }
    } catch (err: any) {
      setError(err.message || "Failed to create account. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verificationCode.trim() || !userId) {
      setError("Please enter the verification code");
      return;
    }

    setVerifying(true);
    setError("");

    try {
      const response = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          code: verificationCode.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Invalid verification code");
      }

      // Email verified, sign in and redirect
      await signUp(userEmail, formData.password);
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message || "Failed to verify email. Please try again.");
    } finally {
      setVerifying(false);
    }
  };

  const handleResendCode = async () => {
    if (!userId || !userEmail) return;

    setError("");
    try {
      const response = await fetch("/api/auth/send-verification-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          email: userEmail,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to resend code");
      }

      // Show success message
      setError(""); // Clear any errors
      alert("Verification code sent! Please check your email.");
      
      // In dev mode, show the code
      if (data.code) {
        console.log("New verification code (dev mode):", data.code);
      }
    } catch (err: any) {
      setError(err.message || "Failed to resend code. Please try again.");
    }
  };

  const passwordRequirements = [
    { met: formData.password.length >= 6, text: "At least 6 characters" },
    { met: /[A-Z]/.test(formData.password), text: "One uppercase letter" },
    { met: /[a-z]/.test(formData.password), text: "One lowercase letter" },
    { met: /[0-9]/.test(formData.password), text: "One number" },
  ];

  // Show verification step if needed
  if (needsVerification) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="text-center mb-8">
            <Link href="/" className="inline-flex items-center justify-center mb-6">
              <QMark px={96} />
            </Link>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">Verify your email</h1>
            <p className="text-slate-600">We sent a verification code to {userEmail}</p>
          </div>

          {/* Verification Form */}
          <div className="bg-white rounded-3xl shadow-2xl p-8 border border-slate-100">
            <form onSubmit={handleVerifyEmail} className="space-y-5">
              {error && (
                <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
                  {error}
                </div>
              )}

              <div>
                <label htmlFor="verificationCode" className="block text-sm font-semibold text-slate-700 mb-2">
                  Verification Code
                </label>
                <input
                  id="verificationCode"
                  type="text"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  required
                  maxLength={6}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-center text-2xl font-mono tracking-widest"
                  placeholder="000000"
                  autoFocus
                />
                <p className="mt-2 text-xs text-slate-500 text-center">
                  Enter the 6-digit code sent to your email
                </p>
              </div>

              <button
                type="submit"
                disabled={verifying || verificationCode.length !== 6}
                className="w-full px-6 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-semibold shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/40 transition-all duration-300 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {verifying ? (
                  <>
                    <QLoader size={18} />
                    Verifying...
                  </>
                ) : (
                  <>
                    Verify Email
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={handleResendCode}
                  className="text-sm text-blue-600 hover:text-blue-700 font-semibold"
                >
                  Didn't receive the code? Resend
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center justify-center mb-6">
            <QMark px={96} />
          </Link>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Create your account</h1>
          <p className="text-slate-600">Start your 14-day free trial. No credit card required.</p>
        </div>

        {/* Signup Form */}
        <div className="bg-white rounded-3xl shadow-2xl p-8 border border-slate-100">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="name" className="block text-sm font-semibold text-slate-700 mb-2">
                Full name
              </label>
              <input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="John Doe"
              />
            </div>

            <div>
              <label htmlFor="companyName" className="block text-sm font-semibold text-slate-700 mb-2">
                Company name
              </label>
              <input
                id="companyName"
                type="text"
                value={formData.companyName}
                onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                required
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="Acme Steel Fabrication"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-slate-700 mb-2">
                Email address
              </label>
              <input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="you@company.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-slate-700 mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all pr-12"
                  placeholder="Create a password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {formData.password && (
                <div className="mt-2 space-y-1">
                  {passwordRequirements.map((req, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-xs">
                      <CheckCircle2 
                        className={`w-4 h-4 ${req.met ? "text-emerald-500" : "text-slate-300"}`} 
                      />
                      <span className={req.met ? "text-emerald-600" : "text-slate-400"}>
                        {req.text}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-semibold text-slate-700 mb-2">
                Confirm password
              </label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  required
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all pr-12"
                  placeholder="Confirm your password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="betaAccessCode" className="block text-sm font-semibold text-slate-700 mb-2">
                Beta Access Code <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <input
                id="betaAccessCode"
                type="text"
                value={formData.betaAccessCode}
                onChange={(e) => setFormData({ ...formData, betaAccessCode: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="Enter beta access code if provided"
              />
              <p className="mt-1 text-xs text-slate-500">
                If you received a beta access code, enter it here. Otherwise, leave blank.
              </p>
            </div>

            <div>
              <label htmlFor="licenseSerial" className="block text-sm font-semibold text-slate-700 mb-2">
                License Serial Key <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <input
                id="licenseSerial"
                type="text"
                value={formData.licenseSerial}
                onChange={(e) => {
                  // Format as XXXX-XXXX-XXXX-XXXX
                  const value = e.target.value.replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 16);
                  const formatted = value.match(/.{1,4}/g)?.join('-') || value;
                  setFormData({ ...formData, licenseSerial: formatted });
                }}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all font-mono"
                placeholder="XXXX-XXXX-XXXX-XXXX"
                maxLength={19}
              />
              <p className="mt-1 text-xs text-slate-500">
                Single-user: Full access including settings | Multi-user: Admin-only settings access
              </p>
            </div>

            <div className="space-y-3 pt-2">
              <div className="text-sm text-slate-600 leading-relaxed">
                <span className="font-semibold text-slate-800">Please review before agreeing:</span>{" "}
                <Link href="/terms" className="text-blue-600 hover:text-blue-700 font-semibold underline">
                  Terms of Service
                </Link>{" "}
                <span className="text-slate-400">•</span>{" "}
                <Link href="/privacy" className="text-blue-600 hover:text-blue-700 font-semibold underline">
                  Privacy Policy
                </Link>
              </div>
              <div className="flex items-start gap-2">
                <input 
                  type="checkbox" 
                  required
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 mt-0.5" 
                />
                <label className="text-sm text-slate-600">
                  I agree to the Terms of Service and Privacy Policy.
                </label>
              </div>
              <div className="flex items-start gap-2">
                <input 
                  type="checkbox" 
                  checked={formData.marketingOptIn}
                  onChange={(e) => setFormData({ ...formData, marketingOptIn: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 mt-0.5" 
                />
                <label className="text-sm text-slate-600">
                  I'd like to receive product updates and marketing communications (optional)
                </label>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full px-6 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-semibold shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/40 transition-all duration-300 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <QLoader size={18} />
                  Creating account...
                </>
              ) : (
                <>
                  Create Account
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-slate-600">
              Already have an account?{" "}
              <Link href="/login" className="text-blue-600 hover:text-blue-700 font-semibold">
                Sign in
              </Link>
            </p>
          </div>
        </div>

        <div className="mt-6 text-center text-sm text-slate-500">
          <Link href="/" className="hover:text-blue-600 transition-colors">
            ← Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}

