'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ShieldCheck,
  Lock,
  ArrowLeft,
  ArrowRight,
  UserCheck,
  Building2,
  ShieldAlert,
  Search,
  KeyRound,
  CheckCircle2,
} from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Pre-fixed Single Super Admin Credentials
  const ADMIN_EMAIL = 'admin@docauth.platform';
  const ADMIN_PASS = 'AdminDocAuth2026!';

  // Pre-configured Verified Demo Issuer Company Credentials
  const DEMO_ISSUER_EMAIL = 'issuer@acmeglobal.com';
  const DEMO_ISSUER_PASS = 'AcmePass2026!';
  const DEMO_COMPANY_DATA = {
    id: 'org-acme-global',
    legalName: 'Acme Global Technologies Ltd',
    issuerId: '0xac4e104fe8b9104c9e82103f8a4bc1265893a90ef56321478cdbe3290124589a',
    organizationType: 'COMPANY',
    status: 'ACTIVE',
    verificationStatus: 'ACTIVE',
    registeredAddress: 'Tower 4, Cyber City, Gurugram, Haryana',
    country: 'India',
    registrationNumber: 'CIN-U72200HR2022PTC098765',
    website: 'https://acme-global.com',
    privacySettings: {
      contactPhone: '+91 124 456 7890',
      showPhonePublicly: false,
      hrContactPerson: 'Sarah Jenkins (Head of HR Operations)',
      showContactPersonPublicly: true,
      description: 'Enterprise Cloud Systems & Decentralized Security Verification Solutions',
      showDescriptionPublicly: true,
    },
    approvedAt: '2026-10-30T10:00:00.000Z',
  };

  const handleSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanEmail = email.trim().toLowerCase();

    // 1. Check Super Admin (Pre-fixed credentials)
    if (cleanEmail === ADMIN_EMAIL.toLowerCase() && password === ADMIN_PASS) {
      router.push('/admin');
      return;
    }

    // 2. Check Demo Issuer Company (Instant pre-approved company)
    if (cleanEmail === DEMO_ISSUER_EMAIL.toLowerCase() && password === DEMO_ISSUER_PASS) {
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('docauth_active_organization', JSON.stringify(DEMO_COMPANY_DATA));

          // Ensure it exists in approved issuers list
          const approved = JSON.parse(localStorage.getItem('docauth_approved_issuers') || '[]');
          if (!approved.some((a: any) => a.issuerId === DEMO_COMPANY_DATA.issuerId)) {
            localStorage.setItem(
              'docauth_approved_issuers',
              JSON.stringify([DEMO_COMPANY_DATA, ...approved]),
            );
          }

          // Ensure it exists in registered issuers list
          const registered = JSON.parse(localStorage.getItem('docauth_registered_issuers') || '[]');
          if (!registered.some((r: any) => r.email === DEMO_ISSUER_EMAIL)) {
            localStorage.setItem(
              'docauth_registered_issuers',
              JSON.stringify([
                {
                  email: DEMO_ISSUER_EMAIL,
                  password: DEMO_ISSUER_PASS,
                  ...DEMO_COMPANY_DATA,
                },
                ...registered,
              ]),
            );
          }
        } catch {
          // Fallback
        }
      }
      router.push('/organizations/dashboard');
      return;
    }

    // 3. Check Registered Issuers in localStorage
    if (typeof window !== 'undefined') {
      try {
        const issuers = JSON.parse(localStorage.getItem('docauth_registered_issuers') || '[]');
        const matched = issuers.find(
          (i: any) => i.email.toLowerCase() === cleanEmail && i.password === password,
        );

        if (matched) {
          if (matched.status === 'SUBMITTED') {
            setError(
              `Application Under Review: "${matched.legalName}" onboarding dossier is awaiting approval by the Super Admin in the Governance Review Queue. Once approved, signing in here will open your Issuer Dashboard directly.`
            );
            return;
          }

          // If approved (ACTIVE), set as active organization and directly open Issuer Dashboard
          localStorage.setItem(
            'docauth_active_organization',
            JSON.stringify({
              legalName: matched.legalName,
              issuerId:
                matched.issuerId ||
                '0x8a92104fe8b9104c9e82103f8a4bc1265893a90ef56321478cdbe3290124589a',
              status: 'ACTIVE',
              registeredAddress: matched.registeredAddress || '',
              country: matched.country || 'India',
              website: matched.website || '',
              privacySettings: matched.privacySettings || {},
            }),
          );
          router.push('/organizations/dashboard');
          return;
        }
      } catch {
        // Fallback
      }
    }

    // If credentials not recognized
    setError(
      'Invalid email or password. Please verify your credentials or register your organization.',
    );
  };

  const prefillAdmin = () => {
    setEmail(ADMIN_EMAIL);
    setPassword(ADMIN_PASS);
    setError(null);
  };

  const prefillIssuer = () => {
    setEmail(DEMO_ISSUER_EMAIL);
    setPassword(DEMO_ISSUER_PASS);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <Link
          href="/"
          className="inline-flex items-center space-x-2 text-xs font-semibold text-slate-500 hover:text-slate-800 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Home</span>
        </Link>
        <div className="flex justify-center">
          <div className="p-3 bg-emerald-600 text-white rounded-2xl shadow-sm">
            <ShieldCheck className="w-8 h-8" />
          </div>
        </div>
        <h2 className="mt-4 text-center text-2xl font-bold tracking-tight text-slate-900">
          Sign In to DocAuth Platform
        </h2>
        <p className="mt-1 text-center text-xs text-slate-600">
          Access your Issuer Dashboard or Platform Administration
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        {/* PUBLIC VERIFIER NOTICE: NO LOGIN REQUIRED */}
        <div className="mb-4 p-4 bg-indigo-50/80 border border-indigo-200 rounded-2xl flex items-center justify-between shadow-sm">
          <div>
            <span className="text-xs font-bold text-indigo-950 block">Are you a Document Verifier?</span>
            <span className="text-[11px] text-indigo-700 block">
              Employers and verifiers do not need an account or login.
            </span>
          </div>
          <Link
            href="/verify"
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs transition flex items-center space-x-1 shadow-sm whitespace-nowrap"
          >
            <Search className="w-3.5 h-3.5" />
            <span>Verify Documents</span>
          </Link>
        </div>

        <div className="bg-white py-8 px-6 shadow-sm rounded-2xl border border-slate-200 sm:px-10">
          {/* Quick Autofill Selector for Testing */}
          <div className="mb-5 p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
            <span className="text-slate-600 font-medium text-[11px]">Quick Autofill for Evaluation:</span>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={prefillAdmin}
                className="px-2.5 py-1 bg-white hover:bg-rose-50 border border-rose-200 text-rose-700 rounded-lg font-semibold text-[11px] shadow-2xs transition"
              >
                🛡️ Super Admin
              </button>
              <button
                type="button"
                onClick={prefillIssuer}
                className="px-2.5 py-1 bg-white hover:bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-lg font-bold text-[11px] shadow-2xs transition"
              >
                🏢 Demo Issuer Company
              </button>
            </div>
          </div>

          <form className="space-y-4" onSubmit={handleSignIn}>
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs font-semibold text-slate-700">Login ID / Email</label>
                <div className="flex items-center space-x-2 text-[10px] font-semibold">
                  <button
                    type="button"
                    onClick={prefillAdmin}
                    className="text-rose-600 hover:text-rose-700 hover:underline"
                  >
                    Autofill Super Admin
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    type="button"
                    onClick={prefillIssuer}
                    className="text-emerald-600 hover:text-emerald-700 hover:underline font-bold"
                  >
                    Autofill Demo Company
                  </button>
                </div>
              </div>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="issuer@acmeglobal.com or admin@docauth.platform"
                className="mt-1 block w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="mt-1 block w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs font-medium">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold transition shadow-sm flex items-center justify-center space-x-2"
            >
              <Lock className="w-4 h-4" />
              <span>Sign In to Dashboard</span>
            </button>
          </form>

          {/* New Issuer Registration Link */}
          <div className="mt-6 pt-4 border-t border-slate-100 text-center">
            <span className="text-xs text-slate-600 block">
              New organization or university?
            </span>
            <Link
              href="/organizations/register"
              className="mt-1 inline-flex items-center space-x-1 text-xs font-bold text-emerald-600 hover:underline"
            >
              <span>Create Issuer Account & Register Organization</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
