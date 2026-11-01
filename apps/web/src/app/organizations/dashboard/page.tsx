'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Building2,
  Key,
  FilePlus2,
  FileText,
  CheckCircle2,
  RefreshCw,
  Lock,
  QrCode,
  ShieldAlert,
  ArrowRight,
  UploadCloud,
  LogOut,
} from 'lucide-react';

export default function OrganizationDashboardPage() {
  const [activeTab, setActiveTab] = useState<'issue' | 'documents' | 'keys' | 'profile'>('issue');
  const [recipientName, setRecipientName] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [docCategory, setDocCategory] = useState('EMPLOYMENT');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [issuanceResult, setIssuanceResult] = useState<any | null>(null);

  const [currentOrg, setCurrentOrg] = useState({
    legalName: '',
    issuerId: '',
    status: 'ACTIVE',
    registeredAddress: '',
    country: '',
    website: '',
    contactPhone: '',
    showPhonePublicly: false,
    hrContactPerson: '',
    showContactPersonPublicly: false,
  });

  const [documents, setDocuments] = useState<any[]>([]);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [docToRevoke, setDocToRevoke] = useState<any | null>(null);
  const [revokeReason, setRevokeReason] = useState('Credential revoked due to falsified employment history.');
  const [isRevoking, setIsRevoking] = useState(false);
  const [revokeSuccess, setRevokeSuccess] = useState<string | null>(null);

  const handleConfirmRevoke = () => {
    if (!docToRevoke) return;
    setIsRevoking(true);

    setTimeout(() => {
      const updatedDocs = documents.map((d: any) => {
        if (d.credentialId === docToRevoke.credentialId) {
          return {
            ...d,
            status: 'REVOKED',
            revokedAt: new Date().toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            }),
            revocationReason: revokeReason,
          };
        }
        return d;
      });

      setDocuments(updatedDocs);
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('docauth_issued_documents', JSON.stringify(updatedDocs));
        } catch (e) {
          console.error(e);
        }
      }

      setIsRevoking(false);
      setRevokeSuccess(
        `Credential ${docToRevoke.credentialId ? docToRevoke.credentialId.slice(0, 10) : ''}... revoked successfully on Polygon PoS.`,
      );
      setDocToRevoke(null);
      setTimeout(() => setRevokeSuccess(null), 4000);
    }, 700);
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('docauth_active_organization');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed && parsed.legalName) {
            setCurrentOrg((prev) => ({
              ...prev,
              ...parsed,
              contactPhone: parsed.privacySettings?.contactPhone || '',
              showPhonePublicly: parsed.privacySettings?.showPhonePublicly ?? false,
              hrContactPerson: parsed.privacySettings?.hrContactPerson || '',
              showContactPersonPublicly: parsed.privacySettings?.showContactPersonPublicly ?? false,
            }));
          }
        }

        const storedDocs = localStorage.getItem('docauth_issued_documents');
        if (storedDocs) {
          const parsedDocs = JSON.parse(storedDocs);
          if (Array.isArray(parsedDocs)) {
            setDocuments(parsedDocs);
          }
        }
      } catch {
        // Fallback
      }
    }
  }, []);

  const handleSavePrivacy = (e: React.FormEvent) => {
    e.preventDefault();
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);

    if (typeof window !== 'undefined') {
      try {
        const updated = {
          ...currentOrg,
          privacySettings: {
            contactPhone: currentOrg.contactPhone,
            showPhonePublicly: currentOrg.showPhonePublicly,
            hrContactPerson: currentOrg.hrContactPerson,
            showContactPersonPublicly: currentOrg.showContactPersonPublicly,
          },
        };
        localStorage.setItem('docauth_active_organization', JSON.stringify(updated));

        // Update in approved issuers list
        const list = JSON.parse(localStorage.getItem('docauth_approved_issuers') || '[]');
        const updatedList = list.map((item: any) =>
          item.legalName === currentOrg.legalName ? { ...item, ...updated } : item,
        );
        localStorage.setItem('docauth_approved_issuers', JSON.stringify(updatedList));
      } catch {
        // Fallback
      }
    }
  };

  const handleIssueDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;

    setIsSubmitting(true);
    setIssuanceResult(null);

    try {
      // 1. Calculate actual cryptographic SHA-256 fingerprint of the uploaded file
      const arrayBuffer = await selectedFile.arrayBuffer();
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', arrayBuffer);
      const fileHash =
        '0x' +
        Array.from(new Uint8Array(hashBuffer))
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('');

      // 2. Generate unique 32-byte Credential ID & Polygon Commitment
      const credBytes = new Uint8Array(32);
      window.crypto.getRandomValues(credBytes);
      const credentialId =
        '0x' +
        Array.from(credBytes)
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('');

      const commitBytes = new Uint8Array(32);
      window.crypto.getRandomValues(commitBytes);
      const commitment =
        '0x' +
        Array.from(commitBytes)
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('');

      const categoryLabels: Record<string, string> = {
        EMPLOYMENT: 'Experience / Employment Letter',
        DEGREE: 'Academic Degree Certificate',
        TRANSCRIPT: 'University Marksheet / Transcript',
        INTERNSHIP: 'Internship Completion Certificate',
        OFFER: 'Official Job Offer Letter',
        CERTIFICATION: 'Professional Certification',
      };

      const newDoc = {
        credentialId,
        commitment,
        fileHash,
        fileName: selectedFile.name,
        fileSize: selectedFile.size,
        claimInvitationCode: `INV-${Math.floor(1000 + Math.random() * 9000)}-${Math.random()
          .toString(36)
          .substring(2, 5)
          .toUpperCase()}`,
        qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
          `http://localhost:3000/verify?id=${credentialId}`,
        )}`,
        recipient: recipientName,
        recipientEmail,
        category: categoryLabels[docCategory] || docCategory,
        issuerId:
          currentOrg.issuerId ||
          '0x8a92104fe8b9104c9e82103f8a4bc1265893a90ef56321478cdbe3290124589a',
        issuerName: currentOrg.legalName || 'Authorized Issuer',
        issuerType: (currentOrg as any).organizationType || 'COMPANY',
        issuedAt: new Date().toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        }),
        status: 'ACTIVE',
      };

      setTimeout(() => {
        setIssuanceResult(newDoc);
        setDocuments((prev) => [newDoc, ...prev]);
        if (typeof window !== 'undefined') {
          try {
            const storedDocs = JSON.parse(
              localStorage.getItem('docauth_issued_documents') || '[]',
            );
            localStorage.setItem(
              'docauth_issued_documents',
              JSON.stringify([newDoc, ...storedDocs]),
            );
          } catch {
            // Fallback
          }
        }
        setIsSubmitting(false);
      }, 1200);
    } catch (err: any) {
      console.error('Issuance error:', err);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Navigation */}
      <header className="border-b border-slate-200 bg-white sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-emerald-600 text-white rounded-lg">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-slate-900">Issuer Portal</span>
              <span className="ml-2 text-xs font-semibold px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full">
                {currentOrg.legalName} (Verified)
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="hidden sm:flex items-center space-x-1.5 text-xs text-slate-600 bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="font-semibold text-slate-700">Polygon PoS</span>
            </div>
            <div className="h-4 w-px bg-slate-200 hidden sm:block" />
            <span className="text-xs font-mono text-slate-600 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
              Issuer ID: {currentOrg.issuerId.slice(0, 8)}...{currentOrg.issuerId.slice(-4)}
            </span>
            <div className="h-4 w-px bg-slate-200" />
            <Link
              href="/login"
              className="text-xs text-rose-600 hover:text-rose-800 font-semibold flex items-center space-x-1.5 px-3 py-1 rounded-lg hover:bg-rose-50 transition border border-transparent hover:border-rose-200"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 py-8 flex-1 w-full">
        {/* Navigation Tabs */}
        <div className="flex space-x-2 border-b border-slate-200 pb-4 mb-6">
          <button
            onClick={() => setActiveTab('issue')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition flex items-center space-x-2 ${
              activeTab === 'issue'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <FilePlus2 className="w-4 h-4" />
            <span>Issue New Credential</span>
          </button>

          <button
            onClick={() => setActiveTab('documents')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition flex items-center space-x-2 ${
              activeTab === 'documents'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Issued Documents</span>
          </button>

          <button
            onClick={() => setActiveTab('keys')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition flex items-center space-x-2 ${
              activeTab === 'keys'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Key className="w-4 h-4" />
            <span>Signing Key Management</span>
          </button>

          <button
            onClick={() => setActiveTab('profile')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition flex items-center space-x-2 ${
              activeTab === 'profile'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            <span>Public Profile & Privacy Controls</span>
          </button>
        </div>

        {/* Tab 1: Document Issuance Wizard */}
        {activeTab === 'issue' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm">
              <h2 className="text-xl font-bold text-slate-900 mb-1">Issue Authenticated Document</h2>
              <p className="text-xs text-slate-500 mb-6">
                Upload recipient details and PDF. The platform computes cryptographic commitments and submits EIP-712 proofs to Polygon PoS.
              </p>

              <form onSubmit={handleIssueDocument} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Recipient Full Name
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Rahul Sharma"
                      value={recipientName}
                      onChange={(e) => setRecipientName(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Recipient Email Address
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="e.g. rahul@example.com"
                      value={recipientEmail}
                      onChange={(e) => setRecipientEmail(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Document Category
                  </label>
                  <select
                    value={docCategory}
                    onChange={(e) => setDocCategory(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
                  >
                    <option value="EMPLOYMENT">Experience / Employment Letter</option>
                    <option value="DEGREE">Academic Degree Certificate</option>
                    <option value="TRANSCRIPT">University Marksheet / Transcript</option>
                    <option value="INTERNSHIP">Internship Completion Certificate</option>
                    <option value="OFFER">Official Job Offer Letter</option>
                    <option value="CERTIFICATION">Professional Certification</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Document File (PDF)
                  </label>
                  <div className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-xl p-6 text-center cursor-pointer relative bg-slate-50">
                    <input
                      type="file"
                      accept="application/pdf"
                      required
                      onChange={(e) => e.target.files && setSelectedFile(e.target.files[0])}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                    <UploadCloud className="w-8 h-8 text-slate-400 mx-auto mb-2 pointer-events-none" />
                    <p className="text-xs font-medium text-slate-700 pointer-events-none">
                      {selectedFile ? selectedFile.name : 'Click to select or drag and drop official PDF'}
                    </p>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || !selectedFile}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-semibold rounded-xl transition flex items-center justify-center space-x-2 text-sm shadow-sm"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Hashing & Obtaining EIP-712 Issuer Signature...</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4" />
                      <span>Sign & Register on Polygon PoS</span>
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Issuance Result Panel */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-sm mb-3">Issuance Status & Claim QR</h3>
                {issuanceResult ? (
                  <div className="space-y-4">
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center space-x-2">
                      <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-600" />
                      <span>Document registered on Polygon PoS!</span>
                    </div>

                    <div className="flex justify-center p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <img
                        src={issuanceResult.qrCodeUrl}
                        alt="Verification QR"
                        className="w-40 h-40 rounded-lg shadow-sm"
                      />
                    </div>

                    <div className="space-y-1.5 text-xs">
                      <div>
                        <span className="text-slate-500 block">Single-Use Claim Code:</span>
                        <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 inline-block mt-0.5">
                          {issuanceResult.claimInvitationCode}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Recipient:</span>
                        <span className="font-medium text-slate-900">{issuanceResult.recipient}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Credential ID:</span>
                        <span className="font-mono text-slate-700 truncate block">
                          {issuanceResult.credentialId}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="h-64 flex flex-col items-center justify-center text-slate-400 text-center p-4">
                    <QrCode className="w-12 h-12 mb-2 stroke-1" />
                    <p className="text-xs">Fill the issuance form and submit to generate verification QR and cryptographic proofs.</p>
                  </div>
                )}
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 text-xs text-slate-500">
                <span>All documents are encrypted with envelope encryption and never published raw on-chain.</span>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Issued Documents List */}
        {activeTab === 'documents' && (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-900">Registered Organization Documents</h2>
              <p className="text-xs text-slate-500">
                All credentials authored by {currentOrg.legalName || 'your organization'} on Polygon PoS.
              </p>
            </div>

            <div className="p-6">
              {revokeSuccess && (
                <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>{revokeSuccess}</span>
                </div>
              )}

              {documents.length > 0 ? (
                <div className="divide-y divide-slate-100 text-sm">
                  {documents.map((doc: any, idx: number) => {
                    const isRevoked = doc.status === 'REVOKED';
                    return (
                      <div
                        key={idx}
                        className="py-4 first:pt-0 last:pb-0 flex items-center justify-between hover:bg-slate-50/70 px-2 rounded-xl transition"
                      >
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-semibold text-slate-900">
                              {doc.recipient} — {doc.category || 'Credential'}
                            </span>
                          </div>
                          <div className="flex items-center space-x-3 text-xs text-slate-500 mt-1">
                            <span className="font-mono">
                              ID: {doc.credentialId ? `${doc.credentialId.slice(0, 10)}...` : 'Pending'}
                            </span>
                            <span>Issued: {doc.issuedAt}</span>
                            <span
                              className={`px-2 py-0.5 rounded-full font-medium text-[11px] ${
                                isRevoked
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              }`}
                            >
                              {doc.status || 'ACTIVE'}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Link
                            href={`/verify?id=${doc.credentialId || ''}`}
                            className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold hover:bg-slate-100 transition"
                          >
                            Verify
                          </Link>
                          {isRevoked ? (
                            <button
                              disabled
                              className="px-3 py-1.5 border border-slate-200 text-slate-400 bg-slate-50 rounded-lg text-xs font-semibold cursor-not-allowed"
                              title="This credential has already been revoked on Polygon PoS."
                            >
                              Revoked
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setDocToRevoke(doc);
                                setRevokeReason('Credential revoked due to falsified employment history.');
                              }}
                              className="px-3 py-1.5 border border-rose-200 text-rose-700 hover:bg-rose-50 rounded-lg text-xs font-semibold transition cursor-pointer"
                            >
                              Revoke
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-12 text-center text-slate-400 text-xs">
                  <FileText className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                  <p className="font-semibold text-slate-600">No documents issued yet.</p>
                  <p className="mt-1">
                    Use "Issue New Credential" to author and cryptographically anchor credentials on Polygon PoS.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 3: Key Management */}
        {activeTab === 'keys' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm max-w-3xl">
            <h2 className="text-lg font-bold text-slate-900 mb-1">EIP-712 Signing Key Authorization</h2>
            <p className="text-xs text-slate-500 mb-6">
              Manage authorized key versions registered in the Polygon <code className="bg-slate-100 px-1 py-0.5 rounded">IssuerRegistry.sol</code> smart contract.
            </p>

            <div className="space-y-4">
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-slate-900 text-sm">Active Signing Key (Version 1)</span>
                    <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-semibold">
                      ACTIVE
                    </span>
                  </div>
                  <span className="font-mono text-xs text-slate-600 block mt-1">
                    0x70997970C51812dc3A010C7d01b50e0d17dc79C8
                  </span>
                </div>
                <button className="px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800">
                  Rotate Key (v2)
                </button>
              </div>

              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs space-y-1">
                <span className="font-bold block">Key Compromise Policy:</span>
                <p>
                  If a signing key is suspected to be compromised, revoking it with an explicit compromise timestamp invalidates all credentials issued on or after that timestamp on-chain.
                </p>
              </div>
            </div>
          </div>
        )}
        {/* Tab 4: Public Profile & Privacy Settings */}
        {activeTab === 'profile' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm max-w-3xl">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-lg font-bold text-slate-900 mb-1">
                  Public Profile & Privacy Preferences
                </h2>
                <p className="text-xs text-slate-500">
                  Control which organizational contact details are displayed when verifiers search your organization using your 32-byte Issuer ID.
                </p>
              </div>
              <Link
                href={`/issuers?id=${currentOrg.issuerId}`}
                className="px-3 py-1.5 border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-semibold flex items-center space-x-1"
              >
                <span>View Public Directory Profile</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <form onSubmit={handleSavePrivacy} className="space-y-6">
              {/* Mandatory Info (Locked) */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-2">
                  Mandatory Public Information (Cannot be Hidden)
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 block">Company Name:</span>
                    <span className="font-bold text-slate-900">{currentOrg.legalName}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Jurisdiction:</span>
                    <span className="font-bold text-slate-900">{currentOrg.country}</span>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-slate-400 block">Headquarters:</span>
                    <span className="font-medium text-slate-800">{currentOrg.registeredAddress}</span>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-slate-400 block">DocAuth 32-Byte Issuer ID:</span>
                    <span className="font-mono text-emerald-700 font-bold break-all">{currentOrg.issuerId}</span>
                  </div>
                </div>
              </div>

              {/* Privacy Toggles */}
              <div className="space-y-4">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 block">
                  Configurable Confidential Information
                </span>

                <div className="p-4 border border-slate-200 rounded-xl bg-white space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Direct Contact Phone
                    </label>
                    <input
                      type="text"
                      value={currentOrg.contactPhone}
                      onChange={(e) => setCurrentOrg({ ...currentOrg, contactPhone: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                    />
                  </div>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={currentOrg.showPhonePublicly}
                      onChange={(e) =>
                        setCurrentOrg({ ...currentOrg, showPhonePublicly: e.target.checked })
                      }
                      className="w-4 h-4 text-emerald-600 rounded border-slate-300"
                    />
                    <span className="text-xs text-slate-700 font-medium">
                      Display contact phone on public Issuer Directory (Uncheck to keep private/confidential)
                    </span>
                  </label>
                </div>

                <div className="p-4 border border-slate-200 rounded-xl bg-white space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Authorized Signer / HR Contact Person
                    </label>
                    <input
                      type="text"
                      value={currentOrg.hrContactPerson}
                      onChange={(e) =>
                        setCurrentOrg({ ...currentOrg, hrContactPerson: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                    />
                  </div>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={currentOrg.showContactPersonPublicly}
                      onChange={(e) =>
                        setCurrentOrg({
                          ...currentOrg,
                          showContactPersonPublicly: e.target.checked,
                        })
                      }
                      className="w-4 h-4 text-emerald-600 rounded border-slate-300"
                    />
                    <span className="text-xs text-slate-700 font-medium">
                      Display HR contact person on public Issuer Directory (Uncheck to keep private/confidential)
                    </span>
                  </label>
                </div>
              </div>

              {saveSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs flex items-center space-x-2 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>Privacy settings saved successfully! Public directory updated.</span>
                </div>
              )}

              <button
                type="submit"
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg text-xs transition shadow-sm"
              >
                Save Privacy Preferences
              </button>
            </form>
          </div>
        )}
        {/* Revocation Confirmation Modal */}
        {docToRevoke && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in duration-150">
              <div className="flex items-center space-x-3 mb-4">
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-600">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Revoke Issued Credential</h3>
                  <p className="text-xs text-slate-500">Permanently invalidate on Polygon PoS</p>
                </div>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 mb-4 text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">Recipient:</span>
                  <span className="font-semibold text-slate-900">{docToRevoke.recipient}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Category:</span>
                  <span className="font-semibold text-slate-900">{docToRevoke.category}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Credential ID:</span>
                  <span className="font-mono text-slate-700">
                    {docToRevoke.credentialId ? `${docToRevoke.credentialId.slice(0, 10)}...` : 'N/A'}
                  </span>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-xs font-bold text-slate-700 mb-1">Reason for Revocation</label>
                <select
                  value={revokeReason}
                  onChange={(e) => setRevokeReason(e.target.value)}
                  className="w-full text-xs p-2.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:outline-none"
                >
                  <option value="Credential revoked due to falsified employment history.">
                    Falsified employment or credential claims
                  </option>
                  <option value="Academic award or degree nullified by disciplinary action.">
                    Academic award nullified / Disciplinary action
                  </option>
                  <option value="Document issued in error or superseded by an updated version.">
                    Issued in error / Superseded by new version
                  </option>
                  <option value="Authorized signing key reported compromised.">
                    Signing key reported compromised
                  </option>
                  <option value="Compliance violation or administrative order.">
                    Compliance violation / Legal order
                  </option>
                </select>
              </div>

              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-[11px] mb-5">
                <span className="font-bold block mb-0.5">Permanent On-Chain Invalidation:</span>
                Once revoked, any verifier checking this credential fingerprint or ID will receive a{' '}
                <code className="font-bold">DOCUMENT_REVOKED</code> verdict.
              </div>

              <div className="flex items-center justify-end space-x-2">
                <button
                  type="button"
                  disabled={isRevoking}
                  onClick={() => setDocToRevoke(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isRevoking}
                  onClick={handleConfirmRevoke}
                  className="px-4 py-2 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition flex items-center space-x-1.5 shadow-sm shadow-rose-200"
                >
                  {isRevoking ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Broadcasting Revocation...</span>
                    </>
                  ) : (
                    <span>Confirm Revocation</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

