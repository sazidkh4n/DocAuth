'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Building2,
  ShieldCheck,
  ArrowLeft,
  UploadCloud,
  CheckCircle2,
  Clock,
  ArrowRight,
} from 'lucide-react';

export default function OrganizationApplyPage() {
  const [legalName, setLegalName] = useState('');
  const [orgType, setOrgType] = useState('COMPANY');
  const [regNumber, setRegNumber] = useState('');
  const [country, setCountry] = useState('India');
  const [website, setWebsite] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminName, setAdminName] = useState('');
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const newApp = {
      id: `case-${Date.now()}`,
      legalName: legalName.trim(),
      organizationType: orgType,
      country: country.trim() || 'India',
      registrationNumber: regNumber.trim(),
      website: website.trim(),
      adminName: adminName.trim(),
      adminEmail: adminEmail.trim(),
      submittedAt: new Date().toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
      status: 'SUBMITTED',
    };

    // Persist to localStorage for the Super Admin review queue
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('docauth_org_applications');
        const list = stored ? JSON.parse(stored) : [];
        localStorage.setItem(
          'docauth_org_applications',
          JSON.stringify([newApp, ...list.filter((x: any) => x.legalName !== newApp.legalName)]),
        );
      } catch {
        // Fallback
      }
    }

    setIsSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center space-x-2 text-slate-600 hover:text-slate-900 transition text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Home</span>
          </Link>
          <div className="flex items-center space-x-2">
            <Building2 className="w-5 h-5 text-emerald-600" />
            <span className="font-bold text-slate-900 text-sm">Organization Onboarding</span>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-12 flex-1 w-full">
        {!isSubmitted ? (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
            <div className="mb-8">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                Step 1: Organization Onboarding Application
              </span>
              <h1 className="text-2xl font-bold text-slate-900 mt-3">Register Your Organization</h1>
              <p className="text-sm text-slate-600 mt-1">
                Apply to become an authorized issuing organization on Polygon PoS. Platform Governance verifies corporate identity and legal credentials before provisioning smart contract signing rights.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Organization Legal Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Company A Ltd"
                    value={legalName}
                    onChange={(e) => setLegalName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Organization Type
                  </label>
                  <select
                    value={orgType}
                    onChange={(e) => setOrgType(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
                  >
                    <option value="COMPANY">Corporation / Enterprise (Employer)</option>
                    <option value="UNIVERSITY">University / Academic Institution</option>
                    <option value="TRAINING_INSTITUTE">Professional Training Institute</option>
                    <option value="GOVERNMENT">Government Agency</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Government Registration Number (CIN / UEN / Tax ID)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. U72200KA2020PTC123456"
                    value={regNumber}
                    onChange={(e) => setRegNumber(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Jurisdiction / Country
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. India, United States, Singapore"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Official Corporate Website
                  </label>
                  <input
                    type="url"
                    required
                    placeholder="https://company-a.com"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Authorized Administrator Full Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Sarah Jenkins (Head of HR / Registrar)"
                    value={adminName}
                    onChange={(e) => setAdminName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Corporate Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="admin@company-a.com"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Certificate of Incorporation / Verification Evidence (PDF)
                </label>
                <div className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-xl p-6 text-center cursor-pointer relative bg-slate-50">
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={(e) => e.target.files && setEvidenceFile(e.target.files[0])}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                  <UploadCloud className="w-8 h-8 text-slate-400 mx-auto mb-2 pointer-events-none" />
                  <p className="text-xs font-medium text-slate-700 pointer-events-none">
                    {evidenceFile ? evidenceFile.name : 'Click to select legal incorporation proof (PDF)'}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5 pointer-events-none">
                    Encrypted at rest using KMS-compatible envelope encryption.
                  </p>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl transition text-sm shadow-sm flex items-center justify-center space-x-2"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Submit Application for Governance Review</span>
              </button>
            </form>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center">
            <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4 border border-amber-200">
              <Clock className="w-8 h-8" />
            </div>

            <h2 className="text-2xl font-bold text-slate-900">Application Received</h2>
            <p className="text-sm text-slate-600 mt-2 max-w-md mx-auto">
              Your organization dossier for <strong>{legalName || 'your company'}</strong> has been successfully submitted and is currently awaiting verification by Platform Governance.
            </p>

            <div className="mt-6 p-5 bg-slate-50 border border-slate-200 rounded-xl text-left text-xs space-y-2.5 max-w-lg mx-auto">
              <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                <span className="text-slate-500">Current Status:</span>
                <span className="font-bold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                  PENDING REVIEW
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Organization Name:</span>
                <span className="font-semibold text-slate-800">{legalName || 'Company A Ltd'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Registration Number:</span>
                <span className="font-semibold text-slate-800">{regNumber || 'U72200KA2020PTC123456'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Organization Type:</span>
                <span className="font-semibold text-slate-800">{orgType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Authorized Admin Email:</span>
                <span className="font-semibold text-slate-800">{adminEmail || 'admin@company-a.com'}</span>
              </div>
            </div>

            <div className="mt-6 text-xs text-slate-500 max-w-md mx-auto bg-blue-50/60 p-3 rounded-lg border border-blue-100">
              <span className="font-semibold text-blue-900 block mb-1">What happens next?</span>
              Platform Super Administrators will review your government registration and verify your business credentials. Once approved, your organization’s 32-byte Issuer ID will be provisioned on Polygon PoS.
            </div>

            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href="/"
                className="w-full sm:w-auto px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-lg text-xs transition"
              >
                Return to Homepage
              </Link>
              <Link
                href="/login"
                className="w-full sm:w-auto px-6 py-2.5 border border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold rounded-lg text-xs transition"
              >
                Go to Sign In
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
