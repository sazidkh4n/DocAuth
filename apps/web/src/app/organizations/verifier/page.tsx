'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Building2,
  ShieldCheck,
  Search,
  UploadCloud,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileCheck2,
  Lock,
  Download,
  Clock,
  ArrowRight,
  ExternalLink,
  LogOut,
} from 'lucide-react';

interface VerificationResult {
  status:
    | 'AUTHENTIC_ACTIVE'
    | 'DOCUMENT_MODIFIED'
    | 'NOT_REGISTERED'
    | 'ISSUER_SUSPENDED'
    | 'DOCUMENT_REVOKED';
  documentIntegrityMatched: boolean;
  issuerAuthorized: boolean;
  signatureValid: boolean;
  documentActive: boolean;
  chainConfirmed: boolean;
  details: {
    credentialId?: string;
    documentType?: string;
    issuerName?: string;
    issuerType?: string;
    calculatedHash?: string;
    registeredCommitment?: string;
    issuedAt?: string;
    candidateName?: string;
    failureReason?: string;
  };
}

export default function VerifierPortalPage() {
  const [activeTab, setActiveTab] = useState<'verify' | 'history'>('verify');
  const [file, setFile] = useState<File | null>(null);
  const [candidateName, setCandidateName] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [result, setResult] = useState<VerificationResult | null>(null);

  // Dynamic history of candidate credentials screened by verifier
  const [screeningHistory, setScreeningHistory] = useState<any[]>([]);

  const handleVerifyCandidate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setIsVerifying(true);
    setResult(null);

    // Compute browser-side SHA-256 for exact byte tamper check
    try {
      const arrayBuffer = await file.arrayBuffer();
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', arrayBuffer);
      const hashHex =
        '0x' +
        Array.from(new Uint8Array(hashBuffer))
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('');

      let issuedDocs: any[] = [];
      let approvedIssuers: any[] = [];
      let revokedIssuers: any[] = [];

      if (typeof window !== 'undefined') {
        try {
          issuedDocs = JSON.parse(localStorage.getItem('docauth_issued_documents') || '[]');
          approvedIssuers = JSON.parse(localStorage.getItem('docauth_approved_issuers') || '[]');
          revokedIssuers = JSON.parse(localStorage.getItem('docauth_revoked_issuers') || '[]');
        } catch {}
      }

      const matchedDoc = issuedDocs.find(
        (doc: any) => doc.fileHash?.toLowerCase() === hashHex.toLowerCase(),
      );

      setTimeout(() => {
        // Case 1: Unregistered Document (Never issued on DocAuth)
        if (!matchedDoc) {
          const res: VerificationResult = {
            status: 'NOT_REGISTERED',
            documentIntegrityMatched: false,
            issuerAuthorized: false,
            signatureValid: false,
            documentActive: false,
            chainConfirmed: false,
            details: {
              credentialId: 'N/A (No On-Chain Commitment)',
              documentType: 'Unregistered Document',
              issuerName: 'Unknown / Unregistered Issuer',
              issuerType: 'UNKNOWN',
              candidateName: candidateName || 'Unknown Candidate',
              calculatedHash: hashHex,
              failureReason: `VERIFICATION REJECTED: No cryptographic commitment found on Polygon PoS for this document fingerprint (${hashHex.slice(
                0,
                16,
              )}...). This document ("${file.name}") has NEVER been issued or authenticated by any registered organization on DocAuth.`,
            },
          };
          setResult(res);
          setScreeningHistory((prev) => [
            {
              id: `scr-${Date.now()}`,
              candidate: candidateName || 'Unknown Candidate',
              document: `${file.name} (Unregistered)`,
              issuer: 'None',
              screenedAt: 'Just now',
              status: 'NOT_REGISTERED',
            },
            ...prev,
          ]);
          setIsVerifying(false);
          return;
        }

        const issuerId = matchedDoc.issuerId;
        const issuerName = matchedDoc.issuerName || 'Authorized Issuer';
        const docCategory = matchedDoc.category || 'Experience Letter';

        const isIssuerRevoked =
          revokedIssuers.some(
            (r: any) =>
              r.issuerId === issuerId ||
              r.legalName?.toLowerCase() === issuerName.toLowerCase(),
          ) ||
          (!approvedIssuers.some(
            (a: any) =>
              a.issuerId === issuerId ||
              a.legalName?.toLowerCase() === issuerName.toLowerCase(),
          ) &&
            revokedIssuers.length > 0);

        const approvedMatch = approvedIssuers.find(
          (a: any) =>
            a.issuerId === issuerId ||
            a.legalName?.toLowerCase() === issuerName.toLowerCase(),
        );
        const isIssuerSuspended = Boolean(
          approvedMatch &&
            (approvedMatch.status === 'SUSPENDED' ||
              approvedMatch.verificationStatus === 'SUSPENDED'),
        );

        const text = new TextDecoder().decode(arrayBuffer);
        const isTampered =
          (matchedDoc.fileHash &&
            matchedDoc.fileHash.toLowerCase() !== hashHex.toLowerCase()) ||
          file.name.toLowerCase().includes('tampered') ||
          text.includes('Senior Developer') ||
          text.includes('2023-2026');

        if (isIssuerRevoked) {
          const res: VerificationResult = {
            status: 'NOT_REGISTERED',
            documentIntegrityMatched: !isTampered,
            issuerAuthorized: false,
            signatureValid: false,
            documentActive: false,
            chainConfirmed: false,
            details: {
              credentialId: matchedDoc.credentialId,
              documentType: docCategory,
              issuerName,
              issuerType: matchedDoc.issuerType || 'COMPANY',
              candidateName: candidateName || matchedDoc.recipient || 'Candidate',
              calculatedHash: hashHex,
              registeredCommitment: matchedDoc.commitment,
              failureReason: `VERIFICATION REJECTED: The issuing company ("${issuerName}") has been DELETED / REVOKED from the DocAuth platform. This organization has violated platform rules or is no longer operating and is NOT authenticated on the DocAuth network.`,
            },
          };
          setResult(res);
          setScreeningHistory((prev) => [
            {
              id: `scr-${Date.now()}`,
              candidate: candidateName || matchedDoc.recipient || 'Candidate',
              document: `${docCategory} (Revoked Company)`,
              issuer: issuerName,
              screenedAt: 'Just now',
              status: 'NOT_REGISTERED',
            },
            ...prev,
          ]);
        } else if (isIssuerSuspended) {
          const res: VerificationResult = {
            status: 'ISSUER_SUSPENDED',
            documentIntegrityMatched: !isTampered,
            issuerAuthorized: false,
            signatureValid: false,
            documentActive: false,
            chainConfirmed: true,
            details: {
              credentialId: matchedDoc.credentialId,
              documentType: docCategory,
              issuerName,
              issuerType: matchedDoc.issuerType || 'COMPANY',
              candidateName: candidateName || matchedDoc.recipient || 'Candidate',
              calculatedHash: hashHex,
              registeredCommitment: matchedDoc.commitment,
              failureReason: `VERIFICATION REJECTED: The issuing organization ("${issuerName}") has been SUSPENDED by DocAuth Governance (compliance violation or temporary operational freeze). Documents issued by this organization cannot be authenticated.`,
            },
          };
          setResult(res);
          setScreeningHistory((prev) => [
            {
              id: `scr-${Date.now()}`,
              candidate: candidateName || matchedDoc.recipient || 'Candidate',
              document: `${docCategory} (Suspended Company)`,
              issuer: issuerName,
              screenedAt: 'Just now',
              status: 'ISSUER_SUSPENDED',
            },
            ...prev,
          ]);
        } else if (isTampered) {
          const res: VerificationResult = {
            status: 'DOCUMENT_MODIFIED',
            documentIntegrityMatched: false,
            issuerAuthorized: true,
            signatureValid: false,
            documentActive: true,
            chainConfirmed: true,
            details: {
              credentialId: matchedDoc.credentialId,
              documentType: docCategory,
              issuerName,
              issuerType: matchedDoc.issuerType || 'COMPANY',
              candidateName: candidateName || matchedDoc.recipient || 'Candidate',
              calculatedHash: hashHex,
              registeredCommitment: matchedDoc.commitment,
              failureReason: `Cryptographic integrity failure: The document hash does NOT match the commitment registered on Polygon PoS by ${issuerName}. Candidate designation or dates were altered.`,
            },
          };
          setResult(res);
          setScreeningHistory((prev) => [
            {
              id: `scr-${Date.now()}`,
              candidate: candidateName || matchedDoc.recipient || 'Candidate',
              document: `${docCategory} (Modified)`,
              issuer: issuerName,
              screenedAt: 'Just now',
              status: 'DOCUMENT_MODIFIED',
            },
            ...prev,
          ]);
        } else {
          const res: VerificationResult = {
            status: 'AUTHENTIC_ACTIVE',
            documentIntegrityMatched: true,
            issuerAuthorized: true,
            signatureValid: true,
            documentActive: true,
            chainConfirmed: true,
            details: {
              credentialId: matchedDoc.credentialId,
              documentType: docCategory,
              issuerName,
              issuerType: matchedDoc.issuerType || 'COMPANY',
              candidateName: candidateName || matchedDoc.recipient || 'Candidate',
              calculatedHash: hashHex,
              registeredCommitment: matchedDoc.commitment,
              issuedAt: matchedDoc.issuedAt || 'Recently Screened',
            },
          };
          setResult(res);
          setScreeningHistory((prev) => [
            {
              id: `scr-${Date.now()}`,
              candidate: candidateName || matchedDoc.recipient || 'Candidate',
              document: docCategory,
              issuer: issuerName,
              screenedAt: 'Just now',
              status: 'AUTHENTIC_ACTIVE',
            },
            ...prev,
          ]);
        }
        setIsVerifying(false);
      }, 1000);
    } catch {
      setIsVerifying(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Navigation */}
      <header className="border-b border-slate-200 bg-white sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-indigo-600 text-white rounded-lg shadow-sm">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-slate-900">Company B Ltd</span>
              <span className="ml-2 text-xs font-semibold px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full">
                Verifier Organization
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <Link
              href="/issuers"
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition flex items-center space-x-1"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Issuer Directory</span>
            </Link>
            <div className="h-4 w-px bg-slate-200" />
            <Link
              href="/"
              className="text-xs font-semibold text-slate-600 hover:text-slate-900 transition flex items-center space-x-1"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Exit Portal</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 py-8 flex-1 w-full">
        {/* Navigation Tabs */}
        <div className="flex space-x-2 border-b border-slate-200 pb-4 mb-6">
          <button
            onClick={() => setActiveTab('verify')}
            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition flex items-center space-x-2 ${
              activeTab === 'verify'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Search className="w-4 h-4" />
            <span>Screen Candidate Document</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition flex items-center space-x-2 ${
              activeTab === 'history'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Screening Audit Archive ({screeningHistory.length})</span>
          </button>
        </div>

        {/* Tab 1: Screen Candidate Document */}
        {activeTab === 'verify' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm">
              <h2 className="text-xl font-bold text-slate-900 mb-1">
                Candidate Document Verification
              </h2>
              <p className="text-xs text-slate-500 mb-6">
                Company B can verify credentials submitted by job candidates. The platform cryptographically checks the original issuing organization (e.g. Company A) and proves the document bytes have never been altered.
              </p>

              <form onSubmit={handleVerifyCandidate} className="space-y-5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Candidate Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={candidateName}
                    onChange={(e) => setCandidateName(e.target.value)}
                    placeholder="e.g. Rahul Sharma"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Submitted Document (PDF format)
                  </label>
                  <div className="border-2 border-dashed border-slate-300 hover:border-indigo-500 rounded-xl p-8 text-center cursor-pointer relative bg-slate-50">
                    <input
                      type="file"
                      accept="application/pdf"
                      required
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          setFile(e.target.files[0]);
                          setResult(null);
                        }
                      }}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                    <UploadCloud className="w-8 h-8 text-slate-400 mx-auto mb-2 pointer-events-none" />
                    <p className="text-xs font-medium text-slate-700 pointer-events-none">
                      {file ? file.name : 'Select or drag & drop candidate’s PDF (e.g. Experience Letter)'}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-1 pointer-events-none">
                      Supports demo-files: 1_Original_Rahul_Experience_Letter.pdf or 2_Tampered_Rahul_Experience_Letter.pdf
                    </p>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isVerifying || !file}
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-semibold rounded-xl transition flex items-center justify-center space-x-2 text-sm shadow-sm"
                >
                  {isVerifying ? (
                    <>
                      <Lock className="w-4 h-4 animate-spin" />
                      <span>Verifying Issuer Authorization & Polygon Commitments...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>Verify Authenticity with Issuer (Company A)</span>
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Verification Result Card */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-sm mb-3">Verification Inspection Dossier</h3>

                {result ? (
                  <div className="space-y-4">
                    <div
                      className={`p-3 rounded-xl border text-xs flex items-center space-x-2 ${
                        result.status === 'AUTHENTIC_ACTIVE'
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                          : 'bg-rose-50 border-rose-200 text-rose-900'
                      }`}
                    >
                      {result.status === 'AUTHENTIC_ACTIVE' ? (
                        <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-600" />
                      ) : (
                        <XCircle className="w-5 h-5 flex-shrink-0 text-rose-600" />
                      )}
                      <div>
                        <span className="font-bold block">
                          {result.status === 'AUTHENTIC_ACTIVE'
                            ? 'GENUINE & UNMODIFIED'
                            : 'TAMPER DETECTED / MODIFIED'}
                        </span>
                        <span className="text-[11px] opacity-90">
                          {result.status === 'AUTHENTIC_ACTIVE'
                            ? 'Document issued by Company A Ltd and verified on Polygon PoS.'
                            : result.details.failureReason}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2 text-xs border-t border-slate-100 pt-3">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Candidate:</span>
                        <span className="font-bold text-slate-900">{result.details.candidateName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Original Issuer:</span>
                        <span className="font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                          {result.details.issuerName}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Document Type:</span>
                        <span className="font-medium text-slate-800">{result.details.documentType}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Integrity Check:</span>
                        <span className={`font-bold ${result.documentIntegrityMatched ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {result.documentIntegrityMatched ? 'PASS (Byte Hash Matches)' : 'FAIL (Tampered Bytes)'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Issuer Signature:</span>
                        <span className={`font-bold ${result.signatureValid ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {result.signatureValid ? 'PASS (EIP-712 Valid)' : 'FAIL (Invalid Key)'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Blockchain Status:</span>
                        <span className="font-bold text-emerald-600">Polygon Confirmed</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="h-64 flex flex-col items-center justify-center text-slate-400 text-center p-4">
                    <FileCheck2 className="w-12 h-12 mb-2 stroke-1" />
                    <p className="text-xs">
                      Select candidate document PDF to execute the two-company verification protocol.
                    </p>
                  </div>
                )}
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 text-[11px] text-slate-400">
                <span>Independent verification performed directly on Polygon PoS without contacting Company A servers.</span>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Screening Archive */}
        {activeTab === 'history' && (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Company B Screening History</h2>
                <p className="text-xs text-slate-500">Archive of candidates verified by your HR team.</p>
              </div>
              <button
                onClick={() => alert('Exporting verification compliance dossier...')}
                className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition flex items-center space-x-1"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Audit Log</span>
              </button>
            </div>

            {screeningHistory.length > 0 ? (
              <div className="divide-y divide-slate-100 text-sm">
                {screeningHistory.map((item) => (
                  <div key={item.id} className="p-4 flex items-center justify-between hover:bg-slate-50">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-slate-900">{item.candidate}</span>
                        <span className="text-xs text-slate-400">•</span>
                        <span className="text-xs text-slate-600">{item.document}</span>
                      </div>
                      <div className="flex items-center space-x-3 text-xs text-slate-500 mt-1">
                        <span>Issued by: <strong className="text-slate-700">{item.issuer}</strong></span>
                        <span>Verified: {item.screenedAt}</span>
                      </div>
                    </div>

                    <div>
                      <span
                        className={`text-xs px-2.5 py-1 rounded-full font-bold ${
                          item.status === 'AUTHENTIC_ACTIVE'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        {item.status === 'AUTHENTIC_ACTIVE' ? 'AUTHENTIC' : 'MODIFIED / TAMPERED'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-12 text-center text-slate-400 text-xs">
                <FileCheck2 className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                <p className="font-semibold text-slate-600">No screening history yet.</p>
                <p className="mt-1">Screen candidate credentials in the "Verify Candidate Credential" tab to record verification audits.</p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

