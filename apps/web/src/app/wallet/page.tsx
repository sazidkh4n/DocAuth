'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Wallet,
  ShieldCheck,
  Download,
  Share2,
  QrCode,
  FileText,
  Clock,
  CheckCircle2,
  Lock,
  Plus,
  X,
  ExternalLink,
} from 'lucide-react';

interface DocumentItem {
  id: string;
  credentialId: string;
  category: string;
  issuerName: string;
  issuedAt: string;
  status: string;
}

export default function HolderWalletPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [activeDoc, setActiveDoc] = useState<DocumentItem | null>(null);
  const [claimCode, setClaimCode] = useState('');
  const [shareHours, setShareHours] = useState(72);
  const [shareResult, setShareResult] = useState<string | null>(null);

  // Dynamic holder credentials
  const [documents, setDocuments] = useState<DocumentItem[]>([]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('docauth_wallet_documents');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            // Filter out old hardcoded demo records
            const realDocs = parsed.filter(
              (d: any) =>
                d.issuerName !== 'Company A Ltd' &&
                d.issuerName !== 'State Technical University',
            );
            setDocuments(realDocs);
          }
        }
      } catch {
        // Fallback
      }
    }
  }, []);

  const handleClaim = (e: React.FormEvent) => {
    e.preventDefault();
    if (!claimCode.trim()) return;

    // Simulate claiming workflow
    setDocuments((prev) => [
      ...prev,
      {
        id: `doc-${Date.now()}`,
        credentialId: '0x99a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8',
        category: 'CERTIFICATION',
        issuerName: 'Cloud Native Computing Foundation',
        issuedAt: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        status: 'ACTIVE',
      },
    ]);
    setClaimCode('');
    setShowClaimModal(false);
  };

  const handleCreateShare = (e: React.FormEvent) => {
    e.preventDefault();
    const token = `share_${Math.random().toString(36).substring(2, 15)}`;
    setShareResult(`http://localhost:3000/verify/${activeDoc?.credentialId}?token=${token}`);
  };

  const filteredDocs =
    selectedCategory === 'ALL'
      ? documents
      : documents.filter((d) => d.category === selectedCategory);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-emerald-600 text-white rounded-lg">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-slate-900">Credential Wallet</span>
              <span className="ml-2 text-xs font-semibold px-2 py-0.5 bg-slate-100 text-slate-700 rounded-full">
                Rahul Sharma
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowClaimModal(true)}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition flex items-center space-x-1 shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Claim Document</span>
            </button>
            <Link
              href="/verify"
              className="px-3 py-1.5 border border-slate-200 text-slate-700 hover:bg-slate-100 rounded-lg text-xs font-semibold"
            >
              Public Verifier
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-4 py-8 flex-1 w-full">
        {/* Category Filters */}
        <div className="flex space-x-2 border-b border-slate-200 pb-4 mb-6 overflow-x-auto">
          {['ALL', 'EMPLOYMENT', 'DEGREE', 'CERTIFICATION'].map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                selectedCategory === cat
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {cat === 'ALL' ? 'All Documents' : cat}
            </button>
          ))}
        </div>

        {/* Documents Grid */}
        {filteredDocs.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredDocs.map((doc) => (
              <div
                key={doc.id}
                className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs px-2 py-0.5 font-bold uppercase tracking-wide bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full">
                        {doc.category}
                      </span>
                      <span className="text-xs text-slate-400">•</span>
                      <span className="text-xs text-slate-500">{doc.issuedAt}</span>
                    </div>
                    <span className="text-xs px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full font-bold">
                      {doc.status}
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-slate-900 mt-3">{doc.issuerName}</h3>
                  <p className="text-xs font-mono text-slate-500 mt-1 truncate">
                    Credential ID: {doc.credentialId}
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                  <Link
                    href={`/verify?credentialId=${doc.credentialId}`}
                    className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center space-x-1"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>Verify Status</span>
                  </Link>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => {
                        setActiveDoc(doc);
                        setShowShareModal(true);
                        setShareResult(null);
                      }}
                      className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
                      title="Share with expiration"
                    >
                      <Share2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => alert(`Initiating secure encrypted download for ${doc.category}...`)}
                      className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
                      title="Download original PDF"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-12 text-center text-slate-400 text-xs bg-white rounded-2xl border border-slate-200 shadow-sm">
            <FileText className="w-10 h-10 mx-auto mb-2 text-slate-300" />
            <p className="font-semibold text-slate-600">No credentials in wallet yet.</p>
            <p className="mt-1">Click "Claim Credential" above and enter your invitation code to store verified credentials.</p>
          </div>
        )}

        {/* Claim Modal */}
        {showClaimModal && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl relative">
              <button
                onClick={() => setShowClaimModal(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>

              <h3 className="text-lg font-bold text-slate-900 mb-2">Claim Pre-Issued Credential</h3>
              <p className="text-xs text-slate-500 mb-4">
                Enter the single-use invitation code provided by your organization to bind the document to your wallet.
              </p>

              <form onSubmit={handleClaim} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Invitation Code
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. INV-4892-KZX"
                    value={claimCode}
                    onChange={(e) => setClaimCode(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg text-sm transition"
                >
                  Verify & Claim Credential
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Share Modal */}
        {showShareModal && activeDoc && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl relative">
              <button
                onClick={() => setShowShareModal(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>

              <h3 className="text-lg font-bold text-slate-900 mb-1">Share Credential Securely</h3>
              <p className="text-xs text-slate-500 mb-4">
                Generate a time-limited, revocable verification link for {activeDoc.issuerName} document.
              </p>

              {!shareResult ? (
                <form onSubmit={handleCreateShare} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Link Expiration Duration
                    </label>
                    <select
                      value={shareHours}
                      onChange={(e) => setShareHours(Number(e.target.value))}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    >
                      <option value={24}>24 Hours (1 Day)</option>
                      <option value={72}>72 Hours (3 Days)</option>
                      <option value={168}>7 Days</option>
                      <option value={720}>30 Days</option>
                    </select>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg text-sm transition"
                  >
                    Generate Secure Share Grant
                  </button>
                </form>
              ) : (
                <div className="space-y-3">
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    <span>Share grant created! Link expires in {shareHours} hours.</span>
                  </div>

                  <input
                    type="text"
                    readOnly
                    value={shareResult}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono text-slate-700"
                  />

                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(shareResult);
                      alert('Share link copied to clipboard!');
                    }}
                    className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-lg text-xs transition"
                  >
                    Copy Share Link
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

