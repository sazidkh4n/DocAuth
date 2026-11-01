'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Building2,
  ShieldCheck,
  ArrowLeft,
  UploadCloud,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  Lock,
} from 'lucide-react';

export default function OrganizationOnboardingPage() {
  const router = useRouter();

  // Retrieved from Step 1
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');

  // Step 2 Fields - Mandatory Public (Cannot be hidden)
  const [legalName, setLegalName] = useState('');
  const [orgType, setOrgType] = useState('COMPANY');
  const [regAddress, setRegAddress] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('India');
  const [website, setWebsite] = useState('');

  // Step 2 Fields - Optional / Confidential (Privacy Toggleable by Issuer)
  const [contactPhone, setContactPhone] = useState('');
  const [showPhonePublicly, setShowPhonePublicly] = useState(false); // default: hidden

  const [hrContactPerson, setHrContactPerson] = useState('');
  const [showContactPersonPublicly, setShowContactPersonPublicly] = useState(false); // default: hidden

  const [description, setDescription] = useState('');
  const [showDescriptionPublicly, setShowDescriptionPublicly] = useState(true);

  // Official Evidence
  const [regNumber, setRegNumber] = useState('');
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('docauth_pending_issuer_auth');
        if (stored) {
          const parsed = JSON.parse(stored);
          setAdminEmail(parsed.email || '');
          setAdminPassword(parsed.password || '');
        }
      } catch {
        // Fallback
      }
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const companyId = `org-${Date.now()}`;
    const newApp = {
      id: companyId,
      legalName: legalName.trim(),
      organizationType: orgType,
      registeredAddress: `${regAddress.trim()}, ${city.trim()}, ${country.trim()}`,
      city: city.trim(),
      country: country.trim() || 'India',
      website: website.trim(),
      registrationNumber: regNumber.trim(),

      // Admin Auth credentials
      adminEmail: adminEmail.trim(),
      adminPassword: adminPassword,

      // Privacy preferences (which details can be public vs hidden)
      privacySettings: {
        contactPhone,
        showPhonePublicly,
        hrContactPerson,
        showContactPersonPublicly,
        description,
        showDescriptionPublicly,
      },

      submittedAt: new Date().toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
      status: 'SUBMITTED',
    };

    if (typeof window !== 'undefined') {
      try {
        // 1. Add to Admin Review Queue
        const stored = localStorage.getItem('docauth_org_applications');
        const list = stored ? JSON.parse(stored) : [];
        localStorage.setItem(
          'docauth_org_applications',
          JSON.stringify([newApp, ...list.filter((x: any) => x.legalName !== newApp.legalName)]),
        );

        // 2. Save credentials in registered issuers so subsequent logins directly open dashboard
        const issuerCreds = JSON.parse(localStorage.getItem('docauth_registered_issuers') || '[]');
        localStorage.setItem(
          'docauth_registered_issuers',
          JSON.stringify([
            {
              email: newApp.adminEmail,
              password: newApp.adminPassword,
              legalName: newApp.legalName,
              organizationId: companyId,
              status: 'SUBMITTED', // will become ACTIVE when approved by admin
            },
            ...issuerCreds.filter((x: any) => x.email !== newApp.adminEmail),
          ]),
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
            href="/organizations/register"
            className="flex items-center space-x-2 text-slate-600 hover:text-slate-900 transition text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Step 1</span>
          </Link>
          <div className="flex items-center space-x-2">
            <Building2 className="w-5 h-5 text-emerald-600" />
            <span className="font-bold text-slate-900 text-sm">Issuer Onboarding Dossier</span>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-12 flex-1 w-full">
        {!isSubmitted ? (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
            <div className="mb-6">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                Step 2 of 2: Organization Dossier & Privacy Controls
              </span>
              <h1 className="text-2xl font-bold text-slate-900 mt-3">Organization Profile</h1>
              <p className="text-xs text-slate-600 mt-1">
                Linked Login ID: <strong className="text-slate-800">{adminEmail || 'admin@company.com'}</strong>
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* SECTION A: MANDATORY PUBLIC INFO */}
              <div className="border border-slate-200 rounded-xl p-5 bg-slate-50/50">
                <div className="flex items-center space-x-2 mb-3">
                  <Lock className="w-4 h-4 text-slate-700" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    Mandatory Public Information (Cannot be Hidden)
                  </h3>
                </div>
                <p className="text-[11px] text-slate-500 mb-4">
                  For transparency, these official company details are permanently visible to any verifier or member of the public searching by your Issuer ID.
                </p>

                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Company Legal Name *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Acme Corporation or National University"
                        value={legalName}
                        onChange={(e) => setLegalName(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Organization Type *
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

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Registered Headquarters Physical Address *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 123 Business Avenue, Suite 100"
                      value={regAddress}
                      onChange={(e) => setRegAddress(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">City *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Mumbai"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Country *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. India"
                        value={country}
                        onChange={(e) => setCountry(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Website *</label>
                      <input
                        type="url"
                        required
                        placeholder="https://example.com"
                        value={website}
                        onChange={(e) => setWebsite(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION B: OPTIONAL / CONFIDENTIAL PRIVACY CONTROLS */}
              <div className="border border-slate-200 rounded-xl p-5 bg-white shadow-sm">
                <div className="flex items-center space-x-2 mb-2">
                  <Eye className="w-4 h-4 text-emerald-600" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    Optional / Confidential Information (Issuer Privacy Controls)
                  </h3>
                </div>
                <p className="text-[11px] text-slate-500 mb-4">
                  You can choose whether these non-public operational details are visible or hidden from public verifiers searching by your Issuer ID.
                </p>

                <div className="space-y-4">
                  {/* Phone Control */}
                  <div className="p-3 border border-slate-200 rounded-lg bg-slate-50">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex-1">
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Direct Contact Phone
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. +91 80 4000 1234"
                          value={contactPhone}
                          onChange={(e) => setContactPhone(e.target.value)}
                          className="w-full sm:w-72 px-3 py-1.5 rounded-lg border border-slate-300 text-xs bg-white"
                        />
                      </div>
                      <label className="flex items-center space-x-2 cursor-pointer mt-2 sm:mt-0">
                        <input
                          type="checkbox"
                          checked={showPhonePublicly}
                          onChange={(e) => setShowPhonePublicly(e.target.checked)}
                          className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                        />
                        <span className="text-xs text-slate-700 font-medium">
                          {showPhonePublicly ? (
                            <span className="text-emerald-700 font-bold flex items-center space-x-1">
                              <Eye className="w-3.5 h-3.5 inline mr-1" /> Visible to Public
                            </span>
                          ) : (
                            <span className="text-slate-500 flex items-center space-x-1">
                              <EyeOff className="w-3.5 h-3.5 inline mr-1" /> Hidden / Confidential
                            </span>
                          )}
                        </span>
                      </label>
                    </div>
                  </div>

                  {/* HR Signer Control */}
                  <div className="p-3 border border-slate-200 rounded-lg bg-slate-50">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex-1">
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Authorized Signer / HR Contact
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Sarah Jenkins (HR Director)"
                          value={hrContactPerson}
                          onChange={(e) => setHrContactPerson(e.target.value)}
                          className="w-full sm:w-72 px-3 py-1.5 rounded-lg border border-slate-300 text-xs bg-white"
                        />
                      </div>
                      <label className="flex items-center space-x-2 cursor-pointer mt-2 sm:mt-0">
                        <input
                          type="checkbox"
                          checked={showContactPersonPublicly}
                          onChange={(e) => setShowContactPersonPublicly(e.target.checked)}
                          className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                        />
                        <span className="text-xs text-slate-700 font-medium">
                          {showContactPersonPublicly ? (
                            <span className="text-emerald-700 font-bold flex items-center space-x-1">
                              <Eye className="w-3.5 h-3.5 inline mr-1" /> Visible to Public
                            </span>
                          ) : (
                            <span className="text-slate-500 flex items-center space-x-1">
                              <EyeOff className="w-3.5 h-3.5 inline mr-1" /> Hidden / Confidential
                            </span>
                          )}
                        </span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Official Registration Number & Evidence */}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Government Registration Number (CIN / UEN / Tax ID) *
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
                  </div>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl transition text-sm shadow-sm flex items-center justify-center space-x-2"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Complete Onboarding & Submit to Governance</span>
              </button>
            </form>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center">
            <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4 border border-amber-200">
              <Clock className="w-8 h-8" />
            </div>

            <h2 className="text-2xl font-bold text-slate-900">Application Submitted for Approval</h2>
            <p className="text-sm text-slate-600 mt-2 max-w-md mx-auto">
              Your organization dossier for <strong>{legalName || 'your company'}</strong> has been registered with your login ID <strong>{adminEmail}</strong>.
            </p>

            <div className="mt-6 p-5 bg-slate-50 border border-slate-200 rounded-xl text-left text-xs space-y-2.5 max-w-lg mx-auto">
              <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                <span className="text-slate-500">Status:</span>
                <span className="font-bold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                  PENDING ADMIN APPROVAL
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Login ID:</span>
                <span className="font-semibold text-slate-800">{adminEmail}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Organization Name:</span>
                <span className="font-semibold text-slate-800">{legalName || 'Company A Ltd'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Registered Address:</span>
                <span className="font-semibold text-slate-800">{regAddress}, {city}, {country}</span>
              </div>
            </div>

            <div className="mt-6 text-xs text-slate-500 max-w-md mx-auto bg-blue-50/60 p-3.5 rounded-lg border border-blue-100">
              <span className="font-semibold text-blue-900 block mb-1">Next Time You Return</span>
              Once approved by the Super Admin, simply log in with your email and password at the Sign In page. You will go directly to your Issuer Dashboard and will never be asked to fill this onboarding form again.
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

