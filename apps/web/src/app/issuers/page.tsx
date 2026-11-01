'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Building2,
  ShieldCheck,
  Search,
  CheckCircle2,
  Lock,
  Eye,
  EyeOff,
  Globe,
  MapPin,
  Calendar,
  ArrowLeft,
  ExternalLink,
  AlertTriangle,
  XCircle,
} from 'lucide-react';

interface IssuerProfile {
  issuerId: string;
  legalName: string;
  organizationType: string;
  registeredAddress: string;
  country: string;
  website: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'REVOKED';
  verifiedAt: string;
  revocationReason?: string;
  revokedAt?: string;

  // Optional / Privacy controls
  contactPhone?: string;
  showPhonePublicly: boolean;
  hrContactPerson?: string;
  showContactPersonPublicly: boolean;
  description?: string;
  showDescriptionPublicly: boolean;
}

function IssuerDirectoryContent() {
  const searchParams = useSearchParams();
  const initialIdQuery = searchParams.get('id') || '';

  const [searchQuery, setSearchQuery] = useState(initialIdQuery);
  const [selectedIssuer, setSelectedIssuer] = useState<IssuerProfile | null>(null);

  // Dynamic approved organizations (loaded exclusively from governance-approved issuers)
  const [issuers, setIssuers] = useState<IssuerProfile[]>([]);

  useEffect(() => {
    // Load dynamically approved and revoked organizations from localStorage
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('docauth_approved_issuers');
        const storedRevoked = localStorage.getItem('docauth_revoked_issuers');

        let formattedApproved: IssuerProfile[] = [];
        let formattedRevoked: IssuerProfile[] = [];

        if (stored) {
          const list = JSON.parse(stored);
          if (Array.isArray(list)) {
            // Filter out old hardcoded demo records
            const realList = list.filter(
              (item: any) =>
                item.legalName !== 'Company A Ltd' &&
                item.legalName !== 'State Technical University' &&
                item.issuerId !== '0x1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c',
            );

            // Clean localStorage if it contained dummy records
            if (realList.length !== list.length) {
              localStorage.setItem('docauth_approved_issuers', JSON.stringify(realList));
            }

            formattedApproved = realList.map((item: any) => ({
              issuerId: item.issuerId,
              legalName: item.legalName,
              organizationType: item.organizationType || 'COMPANY',
              registeredAddress: item.registeredAddress || '',
              country: item.country || '',
              website: item.website || '',
              status: item.verificationStatus === 'ACTIVE' || item.status === 'ACTIVE' ? 'ACTIVE' : 'SUSPENDED',
              verifiedAt: item.approvedAt
                ? new Date(item.approvedAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })
                : 'Recently Verified',
              contactPhone: item.privacySettings?.contactPhone || '',
              showPhonePublicly: Boolean(item.privacySettings?.showPhonePublicly),
              hrContactPerson: item.privacySettings?.hrContactPerson || '',
              showContactPersonPublicly: Boolean(item.privacySettings?.showContactPersonPublicly),
              description: item.privacySettings?.description || '',
              showDescriptionPublicly: Boolean(item.privacySettings?.showDescriptionPublicly),
            }));
          }
        }

        if (storedRevoked) {
          const rList = JSON.parse(storedRevoked);
          if (Array.isArray(rList)) {
            formattedRevoked = rList.map((item: any) => ({
              issuerId: item.issuerId,
              legalName: item.legalName,
              organizationType: item.organizationType || 'COMPANY',
              registeredAddress: item.registeredAddress || 'De-registered from DocAuth Network',
              country: item.country || 'N/A',
              website: item.website || '',
              status: 'REVOKED',
              verifiedAt: 'Revoked by Governance',
              revokedAt: item.revokedAt
                ? new Date(item.revokedAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })
                : 'Recently Revoked',
              revocationReason:
                item.reason || 'Revoked by Platform Super Admin for rule violation or cessation of operations.',
              showPhonePublicly: false,
              showContactPersonPublicly: false,
              showDescriptionPublicly: false,
            }));
          }
        }

        setIssuers([...formattedApproved, ...formattedRevoked]);
      } catch {
        // Fallback
      }
    }
  }, []);

  // Set initial selected issuer if queried by ID
  useEffect(() => {
    if (initialIdQuery) {
      const match = issuers.find(
        (i) =>
          i.issuerId.toLowerCase() === initialIdQuery.toLowerCase() ||
          i.issuerId.toLowerCase().includes(initialIdQuery.toLowerCase()),
      );
      if (match) setSelectedIssuer(match);
    } else if (issuers.length > 0 && !selectedIssuer) {
      setSelectedIssuer(issuers[0]);
    }
  }, [initialIdQuery, issuers, selectedIssuer]);

  const filteredIssuers = issuers.filter(
    (i) =>
      i.legalName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      i.issuerId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      i.country.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link
            href="/verify"
            className="flex items-center space-x-2 text-slate-600 hover:text-slate-900 transition text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Document Verifier</span>
          </Link>
          <div className="flex items-center space-x-2">
            <Building2 className="w-5 h-5 text-emerald-600" />
            <span className="font-bold text-slate-900 text-sm">
              Public Issuer Organization Directory
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 flex-1 w-full">
        {/* Intro Banner */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm mb-8">
          <div className="max-w-3xl">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
              Trust & Transparency Directory
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-3">
              Search Verified Issuing Organizations
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 mt-2 leading-relaxed">
              Verifiers and the public can inspect any organization using their unique 32-byte <strong>DocAuth Issuer ID</strong>. Mandatory company identity, address, and blockchain authorization are permanently public, while internal confidential contact details are managed according to issuer privacy policies.
            </p>

            {/* Search Input Box */}
            <div className="mt-6 relative max-w-xl">
              <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
              <input
                type="text"
                placeholder="Search by Issuer ID (0x...) or Organization Legal Name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
              />
            </div>
          </div>
        </div>

        {/* Directory Layout: List on Left, Profile View on Right */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Organization List */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-fit">
            <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Verified Organizations ({filteredIssuers.length})
              </span>
              <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-bold border border-emerald-200">
                Polygon PoS
              </span>
            </div>

            <div className="divide-y divide-slate-100">
              {filteredIssuers.map((issuer) => (
                <button
                  key={issuer.issuerId}
                  onClick={() => setSelectedIssuer(issuer)}
                  className={`w-full p-4 text-left transition flex flex-col ${
                    selectedIssuer?.issuerId === issuer.issuerId
                      ? 'bg-emerald-50/60 border-l-4 border-emerald-600'
                      : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-slate-900 truncate">
                      {issuer.legalName}
                    </span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                        issuer.status === 'ACTIVE'
                          ? 'bg-emerald-100 text-emerald-800'
                          : issuer.status === 'SUSPENDED'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {issuer.status}
                    </span>
                  </div>
                  <span className="text-xs text-slate-500 mt-0.5">{issuer.country} • {issuer.organizationType}</span>
                  <span className="text-[10px] font-mono text-slate-400 mt-1 truncate">
                    ID: {issuer.issuerId.slice(0, 10)}...{issuer.issuerId.slice(-6)}
                  </span>
                </button>
              ))}

              {filteredIssuers.length === 0 && (
                <div className="p-8 text-center text-slate-400 text-xs">
                  {issuers.length === 0
                    ? 'No organizations verified yet. Approved issuing organizations will appear here.'
                    : 'No matching organization found for this query.'}
                </div>
              )}
            </div>
          </div>

          {/* Detailed Organization Profile View */}
          <div className="lg:col-span-2">
            {selectedIssuer ? (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                {/* Profile Header */}
                <div className="p-6 sm:p-8 border-b border-slate-200 bg-gradient-to-r from-slate-900 to-slate-800 text-white">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/20 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                          {selectedIssuer.organizationType}
                        </span>
                        <span className="text-xs text-slate-400">•</span>
                        <span className="text-xs text-slate-300">Verified on {selectedIssuer.verifiedAt}</span>
                      </div>
                      <h2 className="text-2xl font-bold tracking-tight mt-2">
                        {selectedIssuer.legalName}
                      </h2>
                    </div>

                    {selectedIssuer.status === 'ACTIVE' && (
                      <div className="flex items-center space-x-2 bg-emerald-500/10 border border-emerald-500/30 px-3.5 py-2 rounded-xl text-emerald-300 text-xs font-bold">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span>Polygon PoS Authorized</span>
                      </div>
                    )}
                    {selectedIssuer.status === 'SUSPENDED' && (
                      <div className="flex items-center space-x-2 bg-amber-500/20 border border-amber-500/40 px-3.5 py-2 rounded-xl text-amber-300 text-xs font-bold">
                        <AlertTriangle className="w-4 h-4 text-amber-400" />
                        <span>Issuer Suspended</span>
                      </div>
                    )}
                    {selectedIssuer.status === 'REVOKED' && (
                      <div className="flex items-center space-x-2 bg-rose-500/20 border border-rose-500/40 px-3.5 py-2 rounded-xl text-rose-300 text-xs font-bold">
                        <XCircle className="w-4 h-4 text-rose-400" />
                        <span>Revoked by Governance</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Governance Alert Notices */}
                {selectedIssuer.status === 'REVOKED' && (
                  <div className="p-4 bg-rose-50 border-b border-rose-200 text-rose-900 flex items-start space-x-3">
                    <AlertTriangle className="w-5 h-5 text-rose-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-rose-700">Governance Revocation Notice</h4>
                      <p className="text-xs mt-1">
                        This organization was <strong>permanently revoked / removed</strong> from DocAuth by Platform Super Admin. All credentials and documents issued under this Issuer ID fail verification immediately.
                      </p>
                      {selectedIssuer.revocationReason && (
                        <p className="text-xs mt-1 text-rose-800 font-medium">Reason: {selectedIssuer.revocationReason}</p>
                      )}
                    </div>
                  </div>
                )}
                {selectedIssuer.status === 'SUSPENDED' && (
                  <div className="p-4 bg-amber-50 border-b border-amber-200 text-amber-900 flex items-start space-x-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-amber-700">Governance Suspension Notice</h4>
                      <p className="text-xs mt-1">
                        This organization is <strong>temporarily suspended</strong> by DocAuth Governance (compliance violation or operational freeze). Documents issued by this organization cannot be authenticated until reactivated by the Super Admin.
                      </p>
                    </div>
                  </div>
                )}

                <div className="p-6 sm:p-8 space-y-8">
                  {/* SECTION 1: MANDATORY PUBLIC DETAILS (LOCKED) */}
                  <div>
                    <div className="flex items-center space-x-2 mb-3">
                      <Lock className="w-4 h-4 text-emerald-600" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                        Mandatory Public Details (Permanently Verified by DocAuth)
                      </h3>
                    </div>
                    <p className="text-[11px] text-slate-500 mb-4">
                      These details are verified during legal onboarding and cannot be hidden by the company.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
                        <span className="text-slate-500 text-xs block mb-1">Company Legal Name</span>
                        <span className="font-bold text-slate-900 text-sm block">
                          {selectedIssuer.legalName}
                        </span>
                      </div>

                      <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
                        <span className="text-slate-500 text-xs block mb-1">Country / Jurisdiction</span>
                        <span className="font-bold text-slate-900 text-sm block">
                          {selectedIssuer.country}
                        </span>
                      </div>

                      <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 sm:col-span-2">
                        <span className="text-slate-500 text-xs block mb-1">Registered Physical Headquarters</span>
                        <div className="flex items-center space-x-1.5 font-medium text-slate-800 text-xs">
                          <MapPin className="w-4 h-4 text-slate-500 flex-shrink-0" />
                          <span>{selectedIssuer.registeredAddress}</span>
                        </div>
                      </div>

                      <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 sm:col-span-2">
                        <span className="text-slate-500 text-xs block mb-1">Official Corporate Website</span>
                        <a
                          href={selectedIssuer.website}
                          target="_blank"
                          rel="noreferrer"
                          className="font-medium text-emerald-600 hover:underline text-xs flex items-center space-x-1"
                        >
                          <Globe className="w-4 h-4" />
                          <span>{selectedIssuer.website}</span>
                          <ExternalLink className="w-3 h-3 ml-0.5" />
                        </a>
                      </div>
                    </div>
                  </div>

                  {/* 32-BYTE ISSUER ID CARD */}
                  <div className="p-4 rounded-xl bg-slate-900 text-white">
                    <span className="text-[11px] text-slate-400 uppercase tracking-wider block font-bold mb-1">
                      DocAuth 32-Byte Issuer ID (On-Chain Reference)
                    </span>
                    <span className="font-mono text-xs text-emerald-400 break-all select-all block bg-slate-800/80 p-2.5 rounded-lg border border-slate-700">
                      {selectedIssuer.issuerId}
                    </span>
                  </div>

                  {/* SECTION 2: CONFIDENTIAL / OPTIONAL PRIVACY DETAILS */}
                  <div>
                    <div className="flex items-center space-x-2 mb-3">
                      <Eye className="w-4 h-4 text-slate-600" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                        Organization Privacy Settings (Configurable by Issuer)
                      </h3>
                    </div>
                    <p className="text-[11px] text-slate-500 mb-4">
                      Non-mandatory organizational operational details respect the issuing company’s privacy preferences.
                    </p>

                    <div className="space-y-3">
                      {/* Contact Phone */}
                      <div className="p-3.5 border border-slate-200 rounded-xl flex items-center justify-between">
                        <div>
                          <span className="text-xs font-semibold text-slate-700 block">Direct Contact Phone</span>
                          <span className="text-xs text-slate-600 mt-0.5 block">
                            {selectedIssuer.showPhonePublicly ? (
                              <strong className="text-slate-900">{selectedIssuer.contactPhone}</strong>
                            ) : (
                              <span className="text-slate-400 italic">Confidential / Hidden by Organization</span>
                            )}
                          </span>
                        </div>
                        <span
                          className={`text-[10px] px-2.5 py-1 rounded-full font-bold flex items-center space-x-1 ${
                            selectedIssuer.showPhonePublicly
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {selectedIssuer.showPhonePublicly ? (
                            <>
                              <Eye className="w-3 h-3 inline mr-1" /> Publicly Visible
                            </>
                          ) : (
                            <>
                              <EyeOff className="w-3 h-3 inline mr-1" /> Hidden by Issuer
                            </>
                          )}
                        </span>
                      </div>

                      {/* HR / Signer Contact */}
                      <div className="p-3.5 border border-slate-200 rounded-xl flex items-center justify-between">
                        <div>
                          <span className="text-xs font-semibold text-slate-700 block">Authorized HR Contact Person</span>
                          <span className="text-xs text-slate-600 mt-0.5 block">
                            {selectedIssuer.showContactPersonPublicly ? (
                              <strong className="text-slate-900">{selectedIssuer.hrContactPerson}</strong>
                            ) : (
                              <span className="text-slate-400 italic">Confidential / Hidden by Organization</span>
                            )}
                          </span>
                        </div>
                        <span
                          className={`text-[10px] px-2.5 py-1 rounded-full font-bold flex items-center space-x-1 ${
                            selectedIssuer.showContactPersonPublicly
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {selectedIssuer.showContactPersonPublicly ? (
                            <>
                              <Eye className="w-3 h-3 inline mr-1" /> Publicly Visible
                            </>
                          ) : (
                            <>
                              <EyeOff className="w-3 h-3 inline mr-1" /> Hidden by Issuer
                            </>
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-96 flex flex-col items-center justify-center text-slate-400 text-center p-8 bg-white rounded-2xl border border-slate-200">
                <Building2 className="w-12 h-12 mb-2 stroke-1" />
                <p className="text-sm">Select an organization from the list or search by Issuer ID.</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default function IssuerDirectoryPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center text-xs text-slate-500 font-medium">
          Loading Issuer Directory...
        </div>
      }
    >
      <IssuerDirectoryContent />
    </Suspense>
  );
}
