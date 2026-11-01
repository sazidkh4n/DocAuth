import Link from 'next/link';
import { ShieldCheck, FileCheck, Building2, UserCheck, Search, Lock, ArrowRight } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Navigation Header */}
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-emerald-600 text-white rounded-lg shadow-sm">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <span className="font-bold text-lg text-slate-900 tracking-tight">DocAuth Platform</span>
              <span className="hidden sm:inline-block ml-2 text-xs font-semibold px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full">
                Polygon PoS
              </span>
            </div>
          </div>

          <nav className="flex items-center space-x-3 sm:space-x-4">
            <Link
              href="/verify"
              className="text-xs sm:text-sm font-medium text-slate-700 hover:text-emerald-600 transition flex items-center space-x-1"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Verify Document</span>
            </Link>
            <Link
              href="/issuers"
              className="text-xs sm:text-sm font-medium text-slate-700 hover:text-emerald-600 transition flex items-center space-x-1"
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Issuer Directory</span>
            </Link>
            <Link
              href="/organizations/register"
              className="hidden sm:inline-block text-xs sm:text-sm font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg hover:bg-emerald-100 transition"
            >
              Register Organization
            </Link>
            <Link
              href="/login"
              className="text-xs sm:text-sm font-medium px-3.5 py-1.5 sm:px-4 sm:py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition"
            >
              Sign In
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center">
          <div className="inline-flex items-center space-x-2 px-3 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-full text-xs font-semibold mb-6">
            <Lock className="w-3.5 h-3.5" />
            <span>Zero-Knowledge Privacy • EIP-712 Signatures • Tamper Evident</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold text-slate-900 tracking-tight max-w-4xl mx-auto leading-tight">
            Decentralized Multi-Document Authentication Infrastructure
          </h1>

          <p className="mt-6 text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
            Mathematically prove the integrity of degrees, employment letters, marksheets, and certifications.
            Anchored on Polygon PoS without ever publishing private document bytes on-chain.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/verify"
              className="w-full sm:w-auto px-8 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl shadow-sm transition flex items-center justify-center space-x-2"
            >
              <span>Verify a Document</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/organizations/register"
              className="w-full sm:w-auto px-8 py-3.5 bg-white border border-slate-300 hover:border-slate-400 text-slate-700 font-semibold rounded-xl shadow-sm transition flex items-center justify-center space-x-2"
            >
              <Building2 className="w-4 h-4" />
              <span>Register Organization</span>
            </Link>
          </div>
        </section>

        {/* The Three Trust Dimensions */}
        <section className="py-16 bg-white border-y border-slate-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-12">
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">
                The Three Fundamental Trust Dimensions
              </h2>
              <p className="mt-3 text-slate-600">
                A matching cryptographic hash alone is never enough. Our platform validates documents across three independent verification boundaries.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Dimension 1 */}
              <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-xl flex items-center justify-center mb-4">
                  <FileCheck className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">1. Document Integrity</h3>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                  Calculates exact-byte SHA-256 and privacy-preserving Keccak-256 commitments. Detects even single-character tampering in designations, dates, or salaries.
                </p>
              </div>

              {/* Dimension 2 */}
              <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="w-12 h-12 bg-blue-100 text-blue-700 rounded-xl flex items-center justify-center mb-4">
                  <UserCheck className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">2. Issuer Authenticity</h3>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                  Verifies EIP-712 typed structured data digital signatures. Cryptographically confirms the signing wallet was authorized for this issuer at issuance time.
                </p>
              </div>

              {/* Dimension 3 */}
              <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="w-12 h-12 bg-purple-100 text-purple-700 rounded-xl flex items-center justify-center mb-4">
                  <Building2 className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">3. Organizational Trust</h3>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                  Validates organizational legal registration and status on Polygon PoS (ACTIVE, SUSPENDED, REVOKED) to guarantee historical auditability.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-8 text-center text-sm text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p>© 2026 Decentralized Document Authentication and Verification Platform. Anchored on Polygon PoS.</p>
        </div>
      </footer>
    </div>
  );
}

